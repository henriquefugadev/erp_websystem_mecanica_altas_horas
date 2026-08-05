import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asUser, createTestDb, seedWorkshopComUsuario } from "../helpers/db";

// Fase 2: diagnóstico → rascunho de orçamento vinculado à OS, e aprovação que
// não duplica OS quando o carro já está no pátio.
describe("Diagnóstico — orçamento a partir da OS", () => {
  let db: PGlite;
  let oficina: { workshopId: string; usuarioId: string };
  let clienteId: string;
  let veiculoId: string;

  beforeAll(async () => {
    db = await createTestDb();
    oficina = await seedWorkshopComUsuario(db, {
      workshopNome: "Mecânica Altas Horas",
      usuarioNome: "Michele",
      usuarioEmail: "michele@altashoras.example",
    });

    const { rows: clienteRows } = await db.query<{ id: string }>(
      `insert into public.cliente (workshop_id, tipo, nome, telefone, created_by)
       values ($1, 'PF', 'Dona Maria', '64999990001', $2) returning id`,
      [oficina.workshopId, oficina.usuarioId]
    );
    clienteId = clienteRows[0].id;

    const { rows: veiculoRows } = await db.query<{ id: string }>(
      `insert into public.veiculo (workshop_id, cliente_id, placa, modelo)
       values ($1, $2, 'DIA1A23', 'Palio') returning id`,
      [oficina.workshopId, clienteId]
    );
    veiculoId = veiculoRows[0].id;
  });

  afterAll(async () => {
    await db.close();
  });

  async function abrirOrdem(queixa: string | null = "Barulho") {
    const { rows } = await asUser(db, oficina.usuarioId, (tx) =>
      tx.query<{ id: string; numero: number }>(
        `insert into public.ordem_servico (workshop_id, cliente_id, veiculo_id, queixa, created_by)
         values ($1, $2, $3, $4, $5) returning id, numero`,
        [oficina.workshopId, clienteId, veiculoId, queixa, oficina.usuarioId]
      )
    );
    return rows[0];
  }

  const ITENS = [
    { tipo: "peca", descricao: "Pastilha de freio", quantidade: 2 },
    { tipo: "servico", descricao: "Troca das pastilhas", quantidade: 1 },
  ];

  async function criarDiagnostico(ordemId: string, itens: unknown[] = ITENS) {
    const { rows } = await asUser(db, oficina.usuarioId, (tx) =>
      tx.query<{ criar_orcamento_da_os: string }>(
        `select public.criar_orcamento_da_os($1, $2::jsonb, $3)`,
        [ordemId, JSON.stringify(itens), oficina.usuarioId]
      )
    );
    return rows[0].criar_orcamento_da_os;
  }

  it("cria rascunho de orçamento herdando cliente/veículo/queixa e vinculado à OS", async () => {
    const os = await abrirOrdem("Freio raspando");
    const orcId = await criarDiagnostico(os.id);

    const { rows } = await db.query<{
      status: string;
      cliente_id: string;
      veiculo_id: string;
      queixa: string | null;
      ordem_servico_id: string | null;
    }>(
      `select status, cliente_id, veiculo_id, queixa, ordem_servico_id
       from public.orcamento where id = $1`,
      [orcId]
    );
    expect(rows[0].status).toBe("rascunho");
    expect(rows[0].cliente_id).toBe(clienteId);
    expect(rows[0].veiculo_id).toBe(veiculoId);
    expect(rows[0].queixa).toBe("Freio raspando");
    expect(rows[0].ordem_servico_id).toBe(os.id);

    // Elo reverso preenchido.
    const { rows: osRows } = await db.query<{ orcamento_id: string | null }>(
      `select orcamento_id from public.ordem_servico where id = $1`,
      [os.id]
    );
    expect(osRows[0].orcamento_id).toBe(orcId);
  });

  it("não duplica rascunho: chamar de novo adiciona itens ao mesmo orçamento", async () => {
    const os = await abrirOrdem();
    const orc1 = await criarDiagnostico(os.id, [
      { tipo: "peca", descricao: "Correia", quantidade: 1 },
    ]);
    const orc2 = await criarDiagnostico(os.id, [
      { tipo: "peca", descricao: "Tensor", quantidade: 1 },
    ]);

    expect(orc2).toBe(orc1);

    const { rows: orcCount } = await db.query<{ count: string }>(
      `select count(*) from public.orcamento where ordem_servico_id = $1`,
      [os.id]
    );
    expect(Number(orcCount[0].count)).toBe(1);

    const { rows: itemCount } = await db.query<{ count: string }>(
      `select count(*) from public.orcamento_item where orcamento_id = $1`,
      [orc1]
    );
    expect(Number(itemCount[0].count)).toBe(2);
  });

  it("itens do diagnóstico nascem com aprovado = null (cliente não respondeu)", async () => {
    const os = await abrirOrdem();
    const orcId = await criarDiagnostico(os.id);
    const { rows } = await db.query<{ aprovado: boolean | null }>(
      `select aprovado from public.orcamento_item where orcamento_id = $1`,
      [orcId]
    );
    expect(rows.every((r) => r.aprovado === null)).toBe(true);
  });

  it("aprovar_orcamento de um orçamento vindo da OS NÃO cria outra OS", async () => {
    const os = await abrirOrdem();
    const orcId = await criarDiagnostico(os.id);

    const { rows: antes } = await db.query<{ count: string }>(
      `select count(*) from public.ordem_servico`
    );
    const totalAntes = Number(antes[0].count);

    const { rows: itensRows } = await db.query<{ id: string }>(
      `select id from public.orcamento_item where orcamento_id = $1`,
      [orcId]
    );
    const idsItens = itensRows.map((r) => r.id);

    const { rows: aprov } = await asUser(db, oficina.usuarioId, (tx) =>
      tx.query<{ aprovar_orcamento: string }>(`select public.aprovar_orcamento($1, $2, $3)`, [
        orcId,
        idsItens,
        oficina.usuarioId,
      ])
    );

    // A OS retornada é a mesma, e o total de OS não aumentou.
    expect(aprov[0].aprovar_orcamento).toBe(os.id);

    const { rows: depois } = await db.query<{ count: string }>(
      `select count(*) from public.ordem_servico`
    );
    expect(Number(depois[0].count)).toBe(totalAntes);

    const { rows: orcRows } = await db.query<{ status: string }>(
      `select status from public.orcamento where id = $1`,
      [orcId]
    );
    expect(orcRows[0].status).toBe("aprovado");
  });

  it("atualizar_itens_orcamento substitui os itens e recalcula o total; bloqueia fora do rascunho", async () => {
    const os = await abrirOrdem();
    const orcId = await criarDiagnostico(os.id);

    await asUser(db, oficina.usuarioId, (tx) =>
      tx.query(`select public.atualizar_itens_orcamento($1, $2::jsonb)`, [
        orcId,
        JSON.stringify([
          { tipo: "peca", descricao: "Amortecedor", quantidade: 2, preco_unitario: 300 },
        ]),
      ])
    );

    const { rows } = await db.query<{ count: string; valor_total: string }>(
      `select (select count(*) from public.orcamento_item where orcamento_id = $1) as count,
              (select valor_total from public.orcamento where id = $1) as valor_total`,
      [orcId]
    );
    expect(Number(rows[0].count)).toBe(1);
    expect(Number(rows[0].valor_total)).toBe(600);

    // Sai do rascunho e a edição passa a ser bloqueada.
    await db.query(`update public.orcamento set status = 'enviado' where id = $1`, [orcId]);
    await expect(
      asUser(db, oficina.usuarioId, (tx) =>
        tx.query(`select public.atualizar_itens_orcamento($1, $2::jsonb)`, [
          orcId,
          JSON.stringify([{ tipo: "peca", descricao: "X", quantidade: 1 }]),
        ])
      )
    ).rejects.toThrow(/rascunho/i);
  });

  it("orçamento avulso (sem OS) continua criando OS ao aprovar", async () => {
    const orcId = await asUser(db, oficina.usuarioId, (tx) =>
      tx
        .query<{ criar_orcamento: string }>(
          `select public.criar_orcamento($1,$2,$3,'Avulso',null,null,'2026-12-30',$4::jsonb,$5)`,
          [
            oficina.workshopId,
            clienteId,
            veiculoId,
            JSON.stringify([
              { tipo: "peca", descricao: "Vela", quantidade: 4, preco_unitario: 25, desconto: 0 },
            ]),
            oficina.usuarioId,
          ]
        )
        .then((r) => r.rows[0].criar_orcamento)
    );

    const { rows: itensRows } = await db.query<{ id: string }>(
      `select id from public.orcamento_item where orcamento_id = $1`,
      [orcId]
    );

    const { rows: aprov } = await asUser(db, oficina.usuarioId, (tx) =>
      tx.query<{ aprovar_orcamento: string }>(`select public.aprovar_orcamento($1,$2,$3)`, [
        orcId,
        itensRows.map((r) => r.id),
        oficina.usuarioId,
      ])
    );
    const novaOsId = aprov[0].aprovar_orcamento;

    const { rows: osRows } = await db.query<{ orcamento_id: string | null }>(
      `select orcamento_id from public.ordem_servico where id = $1`,
      [novaOsId]
    );
    expect(osRows[0].orcamento_id).toBe(orcId);
  });
});
