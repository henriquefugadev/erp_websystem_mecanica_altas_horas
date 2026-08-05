import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asUser, createTestDb, seedWorkshopComUsuario } from "../helpers/db";

// Fase 3: salvar_cotacoes grava fornecedor/custo/preço e recalcula o total do
// orçamento. O preço vem calculado da aplicação (custo × markup) — a RPC só
// escreve, então o teste passa o preço já pronto.
describe("Cotação — salvar_cotacoes", () => {
  let db: PGlite;
  let oficina: { workshopId: string; usuarioId: string };
  let clienteId: string;
  let veiculoId: string;
  let fornecedorId: string;

  beforeAll(async () => {
    db = await createTestDb();
    oficina = await seedWorkshopComUsuario(db, {
      workshopNome: "Mecânica Altas Horas",
      usuarioNome: "Michele",
      usuarioEmail: "michele@altashoras.example",
    });

    const { rows: cli } = await db.query<{ id: string }>(
      `insert into public.cliente (workshop_id, tipo, nome, telefone, created_by)
       values ($1, 'PF', 'Cliente Cotação', '64999990001', $2) returning id`,
      [oficina.workshopId, oficina.usuarioId]
    );
    clienteId = cli[0].id;

    const { rows: vei } = await db.query<{ id: string }>(
      `insert into public.veiculo (workshop_id, cliente_id, placa, modelo)
       values ($1, $2, 'COT1A23', 'Uno') returning id`,
      [oficina.workshopId, clienteId]
    );
    veiculoId = vei[0].id;

    const { rows: forn } = await db.query<{ id: string }>(
      `insert into public.fornecedor (workshop_id, nome, telefone, created_by)
       values ($1, 'Auto Peças Central', '6432001000', $2) returning id`,
      [oficina.workshopId, oficina.usuarioId]
    );
    fornecedorId = forn[0].id;
  });

  afterAll(async () => {
    await db.close();
  });

  async function criarRascunhoComPeca(quantidade: number) {
    const orcId = await asUser(db, oficina.usuarioId, (tx) =>
      tx
        .query<{ criar_orcamento: string }>(
          `select public.criar_orcamento($1,$2,$3,'Cotar',null,null,'2026-12-30',$4::jsonb,$5)`,
          [
            oficina.workshopId,
            clienteId,
            veiculoId,
            JSON.stringify([
              { tipo: "peca", descricao: "Bomba d'água", quantidade, preco_unitario: 0, desconto: 0 },
            ]),
            oficina.usuarioId,
          ]
        )
        .then((r) => r.rows[0].criar_orcamento)
    );

    const { rows } = await db.query<{ id: string }>(
      `select id from public.orcamento_item where orcamento_id = $1`,
      [orcId]
    );
    return { orcId, itemId: rows[0].id };
  }

  it("grava fornecedor, custo e preço; carimba cotado_em; recalcula o total", async () => {
    const { orcId, itemId } = await criarRascunhoComPeca(2);

    // markup padrão = 30% → 100 × 1,30 = 130 (calculado na aplicação, passado pronto).
    await asUser(db, oficina.usuarioId, (tx) =>
      tx.query(`select public.salvar_cotacoes($1::jsonb)`, [
        JSON.stringify([
          { id: itemId, fornecedor_id: fornecedorId, custo_cotado: 100, preco_unitario: 130 },
        ]),
      ])
    );

    const { rows: item } = await db.query<{
      fornecedor_id: string | null;
      custo_cotado: string | null;
      preco_unitario: string;
      cotado_em: string | null;
    }>(
      `select fornecedor_id, custo_cotado, preco_unitario, cotado_em
       from public.orcamento_item where id = $1`,
      [itemId]
    );
    expect(item[0].fornecedor_id).toBe(fornecedorId);
    expect(Number(item[0].custo_cotado)).toBe(100);
    expect(Number(item[0].preco_unitario)).toBe(130);
    expect(item[0].cotado_em).not.toBeNull();

    const { rows: orc } = await db.query<{ valor_total: string }>(
      `select valor_total from public.orcamento where id = $1`,
      [orcId]
    );
    // 2 × 130 = 260
    expect(Number(orc[0].valor_total)).toBe(260);
  });

  it("atribuir só o fornecedor (sem custo) não mexe no preço", async () => {
    const { itemId } = await criarRascunhoComPeca(1);

    await asUser(db, oficina.usuarioId, (tx) =>
      tx.query(`select public.salvar_cotacoes($1::jsonb)`, [
        JSON.stringify([{ id: itemId, fornecedor_id: fornecedorId, custo_cotado: "" }]),
      ])
    );

    const { rows } = await db.query<{
      fornecedor_id: string | null;
      custo_cotado: string | null;
      preco_unitario: string;
    }>(
      `select fornecedor_id, custo_cotado, preco_unitario from public.orcamento_item where id = $1`,
      [itemId]
    );
    expect(rows[0].fornecedor_id).toBe(fornecedorId);
    expect(rows[0].custo_cotado).toBeNull();
    expect(Number(rows[0].preco_unitario)).toBe(0);
  });

  it("isolamento RLS: outra oficina não consegue cotar item alheio", async () => {
    const { itemId } = await criarRascunhoComPeca(1);
    const outra = await seedWorkshopComUsuario(db, {
      workshopNome: "Concorrente",
      usuarioNome: "Outro",
      usuarioEmail: "outro@concorrente.example",
    });

    await asUser(db, outra.usuarioId, (tx) =>
      tx.query(`select public.salvar_cotacoes($1::jsonb)`, [
        JSON.stringify([{ id: itemId, fornecedor_id: null, custo_cotado: 999, preco_unitario: 1299 }]),
      ])
    );

    // O update não afeta a linha da oficina A (RLS), então o custo continua nulo.
    const { rows } = await db.query<{ custo_cotado: string | null }>(
      `select custo_cotado from public.orcamento_item where id = $1`,
      [itemId]
    );
    expect(rows[0].custo_cotado).toBeNull();
  });
});
