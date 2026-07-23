import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asUser, createTestDb, seedWorkshopComUsuario } from "../helpers/db";

async function seedClienteEVeiculo(
  db: PGlite,
  workshopId: string,
  usuarioId: string,
  sufixo: string
) {
  const { rows: clienteRows } = await db.query<{ id: string }>(
    `insert into public.cliente
       (workshop_id, tipo, nome, documento, telefone, cep, logradouro, numero, bairro, cidade, estado, created_by)
     values ($1, 'PF', $2, $3, '11912345678', '01001000', 'Praça da Sé', '100', 'Sé', 'São Paulo', 'SP', $4)
     returning id`,
    [workshopId, `Cliente ${sufixo}`, `1234567890${sufixo}`.slice(0, 11), usuarioId]
  );
  const clienteId = clienteRows[0].id;

  const { rows: veiculoRows } = await db.query<{ id: string }>(
    `insert into public.veiculo (workshop_id, cliente_id, placa, modelo)
     values ($1, $2, $3, 'Gol') returning id`,
    [workshopId, clienteId, `ABC${sufixo}`.padEnd(7, "0").slice(0, 7)]
  );

  return { clienteId, veiculoId: veiculoRows[0].id };
}

const ITENS_PADRAO = [
  { tipo: "servico", descricao: "Troca de óleo", quantidade: 1, preco_unitario: 150, desconto: 0 },
  { tipo: "peca", descricao: "Filtro de óleo", quantidade: 1, preco_unitario: 40, desconto: 0 },
];

describe("Orçamento — cadastro, aprovação e geração de OS", () => {
  let db: PGlite;
  let oficinaA: { workshopId: string; usuarioId: string };
  let oficinaB: { workshopId: string; usuarioId: string };
  let clienteVeiculoA: { clienteId: string; veiculoId: string };
  let clienteVeiculoB: { clienteId: string; veiculoId: string };

  beforeAll(async () => {
    db = await createTestDb();

    oficinaA = await seedWorkshopComUsuario(db, {
      workshopNome: "Mecânica Altas Horas",
      usuarioNome: "Michele",
      usuarioEmail: "michele@altashoras.example",
    });
    oficinaB = await seedWorkshopComUsuario(db, {
      workshopNome: "Oficina Concorrente",
      usuarioNome: "Outro Gerente",
      usuarioEmail: "gerente@concorrente.example",
    });

    clienteVeiculoA = await seedClienteEVeiculo(db, oficinaA.workshopId, oficinaA.usuarioId, "1");
    clienteVeiculoB = await seedClienteEVeiculo(db, oficinaB.workshopId, oficinaB.usuarioId, "2");
  });

  afterAll(async () => {
    await db.close();
  });

  async function criarOrcamento(
    workshopId: string,
    usuarioId: string,
    clienteId: string,
    veiculoId: string,
    itens: unknown[] = ITENS_PADRAO
  ) {
    const { rows } = await asUser(db, usuarioId, (tx) =>
      tx.query<{ criar_orcamento: string }>(
        `select public.criar_orcamento($1,$2,$3,'Barulho no motor',null,null,'2026-08-30',$4::jsonb,$5)`,
        [workshopId, clienteId, veiculoId, JSON.stringify(itens), usuarioId]
      )
    );
    return rows[0].criar_orcamento;
  }

  it("cria o orçamento com o valor total somado corretamente a partir dos itens", async () => {
    const id = await criarOrcamento(
      oficinaA.workshopId,
      oficinaA.usuarioId,
      clienteVeiculoA.clienteId,
      clienteVeiculoA.veiculoId
    );

    const { rows } = await db.query<{ valor_total: string; numero: number; status: string }>(
      `select valor_total, numero, status from public.orcamento where id = $1`,
      [id]
    );
    expect(Number(rows[0].valor_total)).toBe(190);
    expect(rows[0].status).toBe("rascunho");

    const { rows: itensRows } = await db.query<{ count: string }>(
      `select count(*) from public.orcamento_item where orcamento_id = $1`,
      [id]
    );
    expect(Number(itensRows[0].count)).toBe(2);
  });

  it("numera sequencialmente por oficina, independente de outras oficinas", async () => {
    const id1 = await criarOrcamento(
      oficinaA.workshopId,
      oficinaA.usuarioId,
      clienteVeiculoA.clienteId,
      clienteVeiculoA.veiculoId
    );
    const id2 = await criarOrcamento(
      oficinaA.workshopId,
      oficinaA.usuarioId,
      clienteVeiculoA.clienteId,
      clienteVeiculoA.veiculoId
    );
    const idB1 = await criarOrcamento(
      oficinaB.workshopId,
      oficinaB.usuarioId,
      clienteVeiculoB.clienteId,
      clienteVeiculoB.veiculoId
    );

    const { rows } = await db.query<{ id: string; numero: number }>(
      `select id, numero from public.orcamento where id = any($1)`,
      [[id1, id2, idB1]]
    );
    const numeroPorId = Object.fromEntries(rows.map((r) => [r.id, r.numero]));
    expect(numeroPorId[id2]).toBe(numeroPorId[id1] + 1);
    expect(numeroPorId[idB1]).toBe(1);
  });

  it("rejeita orçamento sem nenhum item", async () => {
    await expect(
      asUser(db, oficinaA.usuarioId, (tx) =>
        tx.query(
          `select public.criar_orcamento($1,$2,$3,'Sem itens',null,null,'2026-08-30','[]'::jsonb,$4)`,
          [
            oficinaA.workshopId,
            clienteVeiculoA.clienteId,
            clienteVeiculoA.veiculoId,
            oficinaA.usuarioId,
          ]
        )
      )
    ).rejects.toThrow(/ao menos um item/i);
  });

  it("isolamento RLS: oficina B não enxerga orçamento da oficina A", async () => {
    const id = await criarOrcamento(
      oficinaA.workshopId,
      oficinaA.usuarioId,
      clienteVeiculoA.clienteId,
      clienteVeiculoA.veiculoId
    );

    const { rows } = await asUser(db, oficinaB.usuarioId, (tx) =>
      tx.query(`select id from public.orcamento where id = $1`, [id])
    );
    expect(rows).toHaveLength(0);
  });

  it("aprovar_orcamento (todos os itens) marca 'aprovado' e cria a OS vinculada", async () => {
    const id = await criarOrcamento(
      oficinaA.workshopId,
      oficinaA.usuarioId,
      clienteVeiculoA.clienteId,
      clienteVeiculoA.veiculoId
    );
    const { rows: itensRows } = await db.query<{ id: string }>(
      `select id from public.orcamento_item where orcamento_id = $1`,
      [id]
    );
    const todosOsIds = itensRows.map((r) => r.id);

    const { rows: aprovacaoRows } = await asUser(db, oficinaA.usuarioId, (tx) =>
      tx.query<{ aprovar_orcamento: string }>(
        `select public.aprovar_orcamento($1,$2,$3)`,
        [id, todosOsIds, oficinaA.usuarioId]
      )
    );
    const ordemId = aprovacaoRows[0].aprovar_orcamento;
    expect(ordemId).toBeTruthy();

    const { rows: orcamentoRows } = await db.query<{
      status: string;
      ordem_servico_id: string | null;
    }>(`select status, ordem_servico_id from public.orcamento where id = $1`, [id]);
    expect(orcamentoRows[0].status).toBe("aprovado");
    expect(orcamentoRows[0].ordem_servico_id).toBe(ordemId);

    const { rows: ordemRows } = await db.query<{
      cliente_id: string;
      veiculo_id: string;
      orcamento_id: string | null;
      status: string;
    }>(`select cliente_id, veiculo_id, orcamento_id, status from public.ordem_servico where id = $1`, [
      ordemId,
    ]);
    expect(ordemRows[0].cliente_id).toBe(clienteVeiculoA.clienteId);
    expect(ordemRows[0].veiculo_id).toBe(clienteVeiculoA.veiculoId);
    expect(ordemRows[0].orcamento_id).toBe(id);
    expect(ordemRows[0].status).toBe("aguardando");
  });

  it("aprovar_orcamento com só parte dos itens marca 'aprovado_parcial'", async () => {
    const id = await criarOrcamento(
      oficinaA.workshopId,
      oficinaA.usuarioId,
      clienteVeiculoA.clienteId,
      clienteVeiculoA.veiculoId
    );
    const { rows: itensRows } = await db.query<{ id: string }>(
      `select id from public.orcamento_item where orcamento_id = $1 order by created_at`,
      [id]
    );
    const primeiroItemId = itensRows[0].id;

    await asUser(db, oficinaA.usuarioId, (tx) =>
      tx.query(`select public.aprovar_orcamento($1,$2,$3)`, [
        id,
        [primeiroItemId],
        oficinaA.usuarioId,
      ])
    );

    const { rows: orcamentoRows } = await db.query<{ status: string }>(
      `select status from public.orcamento where id = $1`,
      [id]
    );
    expect(orcamentoRows[0].status).toBe("aprovado_parcial");

    const { rows: itensAprovados } = await db.query<{ id: string; aprovado: boolean }>(
      `select id, aprovado from public.orcamento_item where orcamento_id = $1`,
      [id]
    );
    const aprovados = itensAprovados.filter((i) => i.aprovado);
    expect(aprovados).toHaveLength(1);
    expect(aprovados[0].id).toBe(primeiroItemId);
  });

  it("rejeita aprovar um orçamento que já está aprovado", async () => {
    const id = await criarOrcamento(
      oficinaA.workshopId,
      oficinaA.usuarioId,
      clienteVeiculoA.clienteId,
      clienteVeiculoA.veiculoId
    );
    const { rows: itensRows } = await db.query<{ id: string }>(
      `select id from public.orcamento_item where orcamento_id = $1`,
      [id]
    );
    const idsItens = itensRows.map((r) => r.id);

    await asUser(db, oficinaA.usuarioId, (tx) =>
      tx.query(`select public.aprovar_orcamento($1,$2,$3)`, [id, idsItens, oficinaA.usuarioId])
    );

    await expect(
      asUser(db, oficinaA.usuarioId, (tx) =>
        tx.query(`select public.aprovar_orcamento($1,$2,$3)`, [id, idsItens, oficinaA.usuarioId])
      )
    ).rejects.toThrow(/não é possível aprovar/i);
  });

  it("vw_orcamento calcula status_efetivo 'expirado' quando a validade já passou", async () => {
    const { rows } = await asUser(db, oficinaA.usuarioId, (tx) =>
      tx.query<{ criar_orcamento: string }>(
        `select public.criar_orcamento($1,$2,$3,'Vai expirar',null,null,'2020-01-01',$4::jsonb,$5)`,
        [
          oficinaA.workshopId,
          clienteVeiculoA.clienteId,
          clienteVeiculoA.veiculoId,
          JSON.stringify(ITENS_PADRAO),
          oficinaA.usuarioId,
        ]
      )
    );
    const id = rows[0].criar_orcamento;

    await db.query(`update public.orcamento set status = 'enviado' where id = $1`, [id]);

    const { rows: viewRows } = await asUser(db, oficinaA.usuarioId, (tx) =>
      tx.query<{ status: string; status_efetivo: string }>(
        `select status, status_efetivo from public.vw_orcamento where id = $1`,
        [id]
      )
    );
    expect(viewRows[0].status).toBe("enviado");
    expect(viewRows[0].status_efetivo).toBe("expirado");
  });

  it("trigger de auditoria registra a criação do orçamento", async () => {
    const id = await criarOrcamento(
      oficinaA.workshopId,
      oficinaA.usuarioId,
      clienteVeiculoA.clienteId,
      clienteVeiculoA.veiculoId
    );

    const { rows } = await asUser(db, oficinaA.usuarioId, (tx) =>
      tx.query<{ acao: string }>(
        `select acao from public.auditoria where tabela = 'orcamento' and registro_id = $1`,
        [id]
      )
    );
    expect(rows.map((r) => r.acao)).toContain("INSERT");
  });
});
