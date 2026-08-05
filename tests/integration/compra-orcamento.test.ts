import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asUser, createTestDb, seedWorkshopComUsuario } from "../helpers/db";

// Fase 6: gerar pedidos de compra a partir do orçamento aprovado (um por
// fornecedor) e destravar a OS "aguardando peça" ao receber.
describe("Compra a partir do orçamento", () => {
  let db: PGlite;
  let of: { workshopId: string; usuarioId: string };
  let clienteId: string;
  let veiculoId: string;
  let fornA: string;
  let fornB: string;
  let categoriaDespesa: string;

  beforeAll(async () => {
    db = await createTestDb();
    of = await seedWorkshopComUsuario(db, {
      workshopNome: "Mecânica Altas Horas",
      usuarioNome: "Michele",
      usuarioEmail: "michele@altashoras.example",
    });

    const { rows: c } = await db.query<{ id: string }>(
      `insert into public.cliente (workshop_id, tipo, nome, telefone, created_by)
       values ($1,'PF','Cliente','64999990001',$2) returning id`,
      [of.workshopId, of.usuarioId]
    );
    clienteId = c[0].id;
    const { rows: v } = await db.query<{ id: string }>(
      `insert into public.veiculo (workshop_id, cliente_id, placa, modelo)
       values ($1,$2,'CMP1A23','Fox') returning id`,
      [of.workshopId, clienteId]
    );
    veiculoId = v[0].id;

    const { rows: fa } = await db.query<{ id: string }>(
      `insert into public.fornecedor (workshop_id, nome, created_by) values ($1,'Fornecedor A',$2) returning id`,
      [of.workshopId, of.usuarioId]
    );
    fornA = fa[0].id;
    const { rows: fb } = await db.query<{ id: string }>(
      `insert into public.fornecedor (workshop_id, nome, created_by) values ($1,'Fornecedor B',$2) returning id`,
      [of.workshopId, of.usuarioId]
    );
    fornB = fb[0].id;

    const { rows: cat } = await db.query<{ id: string }>(
      `select id from public.categoria_financeira where workshop_id=$1 and tipo='despesa' limit 1`,
      [of.workshopId]
    );
    categoriaDespesa = cat[0].id;
  });

  afterAll(async () => {
    await db.close();
  });

  async function criarOrcamentoComItens() {
    const orcId = await asUser(db, of.usuarioId, (tx) =>
      tx
        .query<{ criar_orcamento: string }>(
          `select public.criar_orcamento($1,$2,$3,'Compra',null,null,'2026-12-30',$4::jsonb,$5)`,
          [
            of.workshopId,
            clienteId,
            veiculoId,
            JSON.stringify([
              { tipo: "peca", descricao: "Pastilha", quantidade: 2, preco_unitario: 0, desconto: 0 },
              { tipo: "peca", descricao: "Disco", quantidade: 1, preco_unitario: 0, desconto: 0 },
              { tipo: "peca", descricao: "Fluido", quantidade: 1, preco_unitario: 0, desconto: 0 },
              { tipo: "peca", descricao: "Sem fornecedor", quantidade: 1, preco_unitario: 0, desconto: 0 },
            ]),
            of.usuarioId,
          ]
        )
        .then((r) => r.rows[0].criar_orcamento)
    );

    const { rows } = await db.query<{ id: string; descricao: string }>(
      `select id, descricao from public.orcamento_item where orcamento_id=$1 order by created_at`,
      [orcId]
    );
    const porDesc = Object.fromEntries(rows.map((r) => [r.descricao, r.id]));

    // Cotações + aprovação (feitas direto para o teste).
    await db.query(
      `update public.orcamento_item set fornecedor_id=$2, custo_cotado=100, preco_unitario=130, aprovado=true where id=$1`,
      [porDesc["Pastilha"], fornA]
    );
    await db.query(
      `update public.orcamento_item set fornecedor_id=$2, custo_cotado=50, preco_unitario=65, aprovado=true where id=$1`,
      [porDesc["Disco"], fornA]
    );
    await db.query(
      `update public.orcamento_item set fornecedor_id=$2, custo_cotado=200, preco_unitario=260, aprovado=true where id=$1`,
      [porDesc["Fluido"], fornB]
    );
    // "Sem fornecedor" aprovado mas sem fornecedor/custo → fica de fora.
    await db.query(`update public.orcamento_item set aprovado=true where id=$1`, [
      porDesc["Sem fornecedor"],
    ]);

    return { orcId, porDesc };
  }

  it("agrupa por fornecedor: 2 fornecedores → 2 pedidos, item sem fornecedor fica de fora", async () => {
    const { orcId, porDesc } = await criarOrcamentoComItens();

    const { rows: res } = await asUser(db, of.usuarioId, (tx) =>
      tx.query<{ gerar_pedidos_do_orcamento: string[] }>(
        `select public.gerar_pedidos_do_orcamento($1,$2,$3)`,
        [orcId, categoriaDespesa, of.usuarioId]
      )
    );
    const pedidoIds = res[0].gerar_pedidos_do_orcamento;
    expect(pedidoIds).toHaveLength(2);

    // Fornecedor A tem 2 itens; B tem 1.
    const { rows: porFornecedor } = await db.query<{ fornecedor_id: string; itens: string }>(
      `select pc.fornecedor_id, count(pci.*) as itens
       from public.pedido_compra pc
       join public.pedido_compra_item pci on pci.pedido_id = pc.id
       where pc.id = any($1)
       group by pc.fornecedor_id`,
      [pedidoIds]
    );
    const mapa = Object.fromEntries(porFornecedor.map((r) => [r.fornecedor_id, Number(r.itens)]));
    expect(mapa[fornA]).toBe(2);
    expect(mapa[fornB]).toBe(1);

    // preço do pedido = custo cotado; e o item sem fornecedor não virou compra.
    const { rows: itensPedido } = await db.query<{
      preco_unitario: string;
      orcamento_item_id: string;
    }>(
      `select preco_unitario, orcamento_item_id from public.pedido_compra_item
       where pedido_id = any($1)`,
      [pedidoIds]
    );
    expect(itensPedido).toHaveLength(3);
    expect(itensPedido.some((i) => i.orcamento_item_id === porDesc["Sem fornecedor"])).toBe(false);
    const precoPastilha = itensPedido.find((i) => i.orcamento_item_id === porDesc["Pastilha"]);
    expect(Number(precoPastilha?.preco_unitario)).toBe(100);
  });

  it("receber o pedido destrava a OS que estava aguardando peça", async () => {
    // OS parada aguardando peça.
    const { rows: os } = await db.query<{ id: string; numero: number }>(
      `insert into public.ordem_servico (workshop_id, cliente_id, veiculo_id, queixa, status, motivo_parada, data_pausa, created_by)
       values ($1,$2,$3,'Freio','parado','aguardando_peca',now(),$4) returning id, numero`,
      [of.workshopId, clienteId, veiculoId, of.usuarioId]
    );
    const ordemId = os[0].id;

    // Pedido de compra vinculado à OS.
    const pedidoId = await asUser(db, of.usuarioId, (tx) =>
      tx
        .query<{ criar_pedido_compra: string }>(
          `select public.criar_pedido_compra($1,$2,$3,current_date,null,'teste',$4,$5,$6::jsonb)`,
          [
            of.workshopId,
            fornA,
            categoriaDespesa,
            ordemId,
            of.usuarioId,
            JSON.stringify([{ descricao: "Pastilha", quantidade: 2, preco_unitario: 100 }]),
          ]
        )
        .then((r) => r.rows[0].criar_pedido_compra)
    );

    const { rows: item } = await db.query<{ id: string }>(
      `select id from public.pedido_compra_item where pedido_id=$1`,
      [pedidoId]
    );

    await asUser(db, of.usuarioId, (tx) =>
      tx.query(`select public.receber_pedido_compra($1,$2::jsonb,current_date,'2026-12-30','ok',$3)`, [
        pedidoId,
        JSON.stringify([{ pedido_item_id: item[0].id, quantidade: 2 }]),
        of.usuarioId,
      ])
    );

    const { rows: depois } = await db.query<{ status: string; motivo_parada: string | null }>(
      `select status, motivo_parada from public.ordem_servico where id=$1`,
      [ordemId]
    );
    expect(depois[0].status).toBe("aguardando");
    expect(depois[0].motivo_parada).toBeNull();
  });
});
