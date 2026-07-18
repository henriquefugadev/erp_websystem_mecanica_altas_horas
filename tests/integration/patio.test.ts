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

async function buscarCategoriaId(
  db: PGlite,
  workshopId: string,
  tipo: "receita" | "despesa",
  nome: string
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `select id from public.categoria_financeira where workshop_id = $1 and tipo = $2 and nome = $3`,
    [workshopId, tipo, nome]
  );
  return rows[0].id;
}

describe("Pátio — ordem de serviço", () => {
  let db: PGlite;
  let oficinaA: { workshopId: string; usuarioId: string };
  let oficinaB: { workshopId: string; usuarioId: string };
  let clienteVeiculoA: { clienteId: string; veiculoId: string };
  let clienteVeiculoB: { clienteId: string; veiculoId: string };
  let categoriaReceitaA: string;
  let categoriaPecasA: string;

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
    categoriaReceitaA = await buscarCategoriaId(db, oficinaA.workshopId, "receita", "Mão de obra");
    categoriaPecasA = await buscarCategoriaId(db, oficinaA.workshopId, "receita", "Peças");
  });

  afterAll(async () => {
    await db.close();
  });

  async function abrirOrdem(
    workshopId: string,
    usuarioId: string,
    clienteId: string,
    veiculoId: string
  ) {
    const { rows } = await asUser(db, usuarioId, (tx) =>
      tx.query<{ id: string; numero: number }>(
        `insert into public.ordem_servico (workshop_id, cliente_id, veiculo_id, queixa, created_by)
         values ($1, $2, $3, 'Barulho no motor', $4)
         returning id, numero`,
        [workshopId, clienteId, veiculoId, usuarioId]
      )
    );
    return rows[0];
  }

  it("numera sequencialmente por oficina, independente de outras oficinas", async () => {
    const os1 = await abrirOrdem(
      oficinaA.workshopId,
      oficinaA.usuarioId,
      clienteVeiculoA.clienteId,
      clienteVeiculoA.veiculoId
    );
    const os2 = await abrirOrdem(
      oficinaA.workshopId,
      oficinaA.usuarioId,
      clienteVeiculoA.clienteId,
      clienteVeiculoA.veiculoId
    );
    const osB1 = await abrirOrdem(
      oficinaB.workshopId,
      oficinaB.usuarioId,
      clienteVeiculoB.clienteId,
      clienteVeiculoB.veiculoId
    );

    expect(os1.numero).toBe(1);
    expect(os2.numero).toBe(2);
    expect(osB1.numero).toBe(1);
  });

  it("nasce em 'aguardando' sem nenhuma ação manual", async () => {
    const os = await abrirOrdem(
      oficinaA.workshopId,
      oficinaA.usuarioId,
      clienteVeiculoA.clienteId,
      clienteVeiculoA.veiculoId
    );
    const { rows } = await db.query<{ status: string }>(
      `select status from public.ordem_servico where id = $1`,
      [os.id]
    );
    expect(rows[0].status).toBe("aguardando");
  });

  it("isolamento RLS: oficina B não enxerga OS da oficina A", async () => {
    const { rows } = await asUser(db, oficinaB.usuarioId, (tx) =>
      tx.query<{ workshop_id: string }>(`select workshop_id from public.ordem_servico`)
    );
    expect(rows.every((r) => r.workshop_id === oficinaB.workshopId)).toBe(true);
  });

  it("bloqueia INSERT de OS com workshop_id de outra oficina (anti-spoofing)", async () => {
    await expect(
      asUser(db, oficinaA.usuarioId, (tx) =>
        tx.query(
          `insert into public.ordem_servico (workshop_id, cliente_id, veiculo_id, queixa)
           values ($1, $2, $3, 'Forjada')`,
          [oficinaB.workshopId, clienteVeiculoB.clienteId, clienteVeiculoB.veiculoId]
        )
      )
    ).rejects.toThrow();
  });

  it("trigger de auditoria registra a abertura da OS", async () => {
    const os = await abrirOrdem(
      oficinaA.workshopId,
      oficinaA.usuarioId,
      clienteVeiculoA.clienteId,
      clienteVeiculoA.veiculoId
    );
    const { rows } = await asUser(db, oficinaA.usuarioId, (tx) =>
      tx.query<{ acao: string }>(
        `select acao from public.auditoria where tabela = 'ordem_servico' and registro_id = $1`,
        [os.id]
      )
    );
    expect(rows.map((r) => r.acao)).toContain("INSERT");
  });

  it("aceita status 'parado' com galpão atribuído", async () => {
    const os = await abrirOrdem(
      oficinaA.workshopId,
      oficinaA.usuarioId,
      clienteVeiculoA.clienteId,
      clienteVeiculoA.veiculoId
    );
    await asUser(db, oficinaA.usuarioId, (tx) =>
      tx.query(
        `update public.ordem_servico set status = 'parado', galpao = 2, data_pausa = now() where id = $1`,
        [os.id]
      )
    );

    const { rows } = await db.query<{ status: string; galpao: number }>(
      `select status, galpao from public.ordem_servico where id = $1`,
      [os.id]
    );
    expect(rows[0].status).toBe("parado");
    expect(rows[0].galpao).toBe(2);
  });

  it("concluir_ordem_servico com itens gera uma conta a receber por item, ligada à OS", async () => {
    const os = await abrirOrdem(
      oficinaA.workshopId,
      oficinaA.usuarioId,
      clienteVeiculoA.clienteId,
      clienteVeiculoA.veiculoId
    );

    const itens = [
      { categoria_id: categoriaReceitaA, valor: 100 },
      { categoria_id: categoriaPecasA, valor: 250 },
    ];

    const { rows: resultadoRows } = await asUser(db, oficinaA.usuarioId, (tx) =>
      tx.query<{ concluir_ordem_servico: string[] }>(
        `select public.concluir_ordem_servico($1,$2::jsonb,'2026-08-01',$3)`,
        [os.id, JSON.stringify(itens), oficinaA.usuarioId]
      )
    );
    const contaIds = resultadoRows[0].concluir_ordem_servico;
    expect(contaIds).toHaveLength(2);

    const { rows: ordemRows } = await db.query<{
      status: string;
      data_conclusao: string | null;
    }>(`select status, data_conclusao from public.ordem_servico where id = $1`, [os.id]);
    expect(ordemRows[0].status).toBe("concluido");
    expect(ordemRows[0].data_conclusao).not.toBeNull();

    const { rows: contasRows } = await db.query<{
      tipo: string;
      valor_total: string;
      cliente_id: string;
      categoria_id: string;
      ordem_servico_id: string;
    }>(
      `select tipo, valor_total, cliente_id, categoria_id, ordem_servico_id
       from public.conta_financeira where id = any($1) order by valor_total`,
      [contaIds]
    );
    expect(contasRows).toHaveLength(2);
    expect(contasRows.every((c) => c.tipo === "receber")).toBe(true);
    expect(contasRows.every((c) => c.cliente_id === clienteVeiculoA.clienteId)).toBe(true);
    expect(contasRows.every((c) => c.ordem_servico_id === os.id)).toBe(true);
    expect(contasRows.map((c) => Number(c.valor_total))).toEqual([100, 250]);
  });

  it("concluir_ordem_servico sem itens conclui a OS sem gerar conta", async () => {
    const os = await abrirOrdem(
      oficinaA.workshopId,
      oficinaA.usuarioId,
      clienteVeiculoA.clienteId,
      clienteVeiculoA.veiculoId
    );

    const { rows } = await asUser(db, oficinaA.usuarioId, (tx) =>
      tx.query<{ concluir_ordem_servico: string[] }>(
        `select public.concluir_ordem_servico($1,null,null,$2)`,
        [os.id, oficinaA.usuarioId]
      )
    );
    expect(rows[0].concluir_ordem_servico).toEqual([]);

    const { rows: ordemRows } = await db.query<{ status: string }>(
      `select status from public.ordem_servico where id = $1`,
      [os.id]
    );
    expect(ordemRows[0].status).toBe("concluido");

    const { rows: contasRows } = await db.query<{ count: string }>(
      `select count(*) from public.conta_financeira where ordem_servico_id = $1`,
      [os.id]
    );
    expect(Number(contasRows[0].count)).toBe(0);
  });

  it("rejeita concluir uma OS que já está concluída ou cancelada", async () => {
    const os = await abrirOrdem(
      oficinaA.workshopId,
      oficinaA.usuarioId,
      clienteVeiculoA.clienteId,
      clienteVeiculoA.veiculoId
    );
    await asUser(db, oficinaA.usuarioId, (tx) =>
      tx.query(`select public.concluir_ordem_servico($1,null,null,$2)`, [
        os.id,
        oficinaA.usuarioId,
      ])
    );

    await expect(
      asUser(db, oficinaA.usuarioId, (tx) =>
        tx.query(`select public.concluir_ordem_servico($1,null,null,$2)`, [
          os.id,
          oficinaA.usuarioId,
        ])
      )
    ).rejects.toThrow(/não é possível concluir/i);
  });
});
