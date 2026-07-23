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

async function criarPeca(
  db: PGlite,
  workshopId: string,
  usuarioId: string,
  nome: string,
  estoqueMinimo = 0
): Promise<string> {
  const { rows } = await asUser(db, usuarioId, (tx) =>
    tx.query<{ id: string }>(
      `insert into public.peca (workshop_id, nome, estoque_minimo, created_by)
       values ($1, $2, $3, $4) returning id`,
      [workshopId, nome, estoqueMinimo, usuarioId]
    )
  );
  return rows[0].id;
}

async function buscarPeca(db: PGlite, id: string) {
  const { rows } = await db.query<{
    estoque_atual: string;
    custo_medio: string;
  }>(`select estoque_atual, custo_medio from public.peca where id = $1`, [id]);
  return { estoqueAtual: Number(rows[0].estoque_atual), custoMedio: Number(rows[0].custo_medio) };
}

async function registrarEntrada(
  db: PGlite,
  workshopId: string,
  usuarioId: string,
  pecaId: string,
  quantidade: number,
  custoUnitario: number
) {
  await asUser(db, usuarioId, (tx) =>
    tx.query(
      `insert into public.movimentacao_estoque (workshop_id, peca_id, tipo, quantidade, custo_unitario, created_by)
       values ($1, $2, 'entrada', $3, $4, $5)`,
      [workshopId, pecaId, quantidade, custoUnitario, usuarioId]
    )
  );
}

async function abrirOrdemEmExecucao(
  db: PGlite,
  workshopId: string,
  usuarioId: string,
  clienteId: string,
  veiculoId: string
): Promise<string> {
  const { rows } = await asUser(db, usuarioId, (tx) =>
    tx.query<{ id: string }>(
      `insert into public.ordem_servico (workshop_id, cliente_id, veiculo_id, queixa, status, created_by)
       values ($1, $2, $3, 'Troca de peça', 'em_execucao', $4)
       returning id`,
      [workshopId, clienteId, veiculoId, usuarioId]
    )
  );
  return rows[0].id;
}

describe("Estoque — catálogo, ledger e baixa em OS", () => {
  let db: PGlite;
  let oficinaA: { workshopId: string; usuarioId: string };
  let oficinaB: { workshopId: string; usuarioId: string };
  let clienteVeiculoA: { clienteId: string; veiculoId: string };

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
  });

  afterAll(async () => {
    await db.close();
  });

  it("entrada aumenta o saldo e recalcula o custo médio ponderado", async () => {
    const pecaId = await criarPeca(db, oficinaA.workshopId, oficinaA.usuarioId, "Filtro de óleo");

    await registrarEntrada(db, oficinaA.workshopId, oficinaA.usuarioId, pecaId, 10, 20);
    let peca = await buscarPeca(db, pecaId);
    expect(peca.estoqueAtual).toBe(10);
    expect(peca.custoMedio).toBe(20);

    await registrarEntrada(db, oficinaA.workshopId, oficinaA.usuarioId, pecaId, 10, 30);
    peca = await buscarPeca(db, pecaId);
    expect(peca.estoqueAtual).toBe(20);
    expect(peca.custoMedio).toBe(25); // (10*20 + 10*30) / 20
  });

  it("consumir_peca_os baixa o saldo, liga o movimento à OS e usa o custo médio vigente", async () => {
    const pecaId = await criarPeca(db, oficinaA.workshopId, oficinaA.usuarioId, "Pastilha de freio");
    await registrarEntrada(db, oficinaA.workshopId, oficinaA.usuarioId, pecaId, 8, 15);

    const ordemId = await abrirOrdemEmExecucao(
      db,
      oficinaA.workshopId,
      oficinaA.usuarioId,
      clienteVeiculoA.clienteId,
      clienteVeiculoA.veiculoId
    );

    const { rows } = await asUser(db, oficinaA.usuarioId, (tx) =>
      tx.query<{ consumir_peca_os: string }>(
        `select public.consumir_peca_os($1, $2, $3, $4)`,
        [ordemId, pecaId, 3, oficinaA.usuarioId]
      )
    );
    const movimentacaoId = rows[0].consumir_peca_os;

    const peca = await buscarPeca(db, pecaId);
    expect(peca.estoqueAtual).toBe(5);

    const { rows: movRows } = await db.query<{
      tipo: string;
      quantidade: string;
      custo_unitario: string;
      ordem_servico_id: string;
    }>(
      `select tipo, quantidade, custo_unitario, ordem_servico_id from public.movimentacao_estoque where id = $1`,
      [movimentacaoId]
    );
    expect(movRows[0].tipo).toBe("saida_consumo");
    expect(Number(movRows[0].quantidade)).toBe(-3);
    expect(Number(movRows[0].custo_unitario)).toBe(15);
    expect(movRows[0].ordem_servico_id).toBe(ordemId);
  });

  it("bloqueia consumo com saldo insuficiente", async () => {
    const pecaId = await criarPeca(db, oficinaA.workshopId, oficinaA.usuarioId, "Correia dentada");
    await registrarEntrada(db, oficinaA.workshopId, oficinaA.usuarioId, pecaId, 2, 40);

    const ordemId = await abrirOrdemEmExecucao(
      db,
      oficinaA.workshopId,
      oficinaA.usuarioId,
      clienteVeiculoA.clienteId,
      clienteVeiculoA.veiculoId
    );

    await expect(
      asUser(db, oficinaA.usuarioId, (tx) =>
        tx.query(`select public.consumir_peca_os($1, $2, $3, $4)`, [
          ordemId,
          pecaId,
          5,
          oficinaA.usuarioId,
        ])
      )
    ).rejects.toThrow(/saldo insuficiente/i);
  });

  it("bloqueia consumo quando a OS não está em execução/parada", async () => {
    const pecaId = await criarPeca(db, oficinaA.workshopId, oficinaA.usuarioId, "Vela de ignição");
    await registrarEntrada(db, oficinaA.workshopId, oficinaA.usuarioId, pecaId, 4, 10);

    const { rows } = await asUser(db, oficinaA.usuarioId, (tx) =>
      tx.query<{ id: string }>(
        `insert into public.ordem_servico (workshop_id, cliente_id, veiculo_id, queixa, created_by)
         values ($1, $2, $3, 'Revisão', $4) returning id`,
        [oficinaA.workshopId, clienteVeiculoA.clienteId, clienteVeiculoA.veiculoId, oficinaA.usuarioId]
      )
    );
    const ordemAguardandoId = rows[0].id;

    await expect(
      asUser(db, oficinaA.usuarioId, (tx) =>
        tx.query(`select public.consumir_peca_os($1, $2, $3, $4)`, [
          ordemAguardandoId,
          pecaId,
          1,
          oficinaA.usuarioId,
        ])
      )
    ).rejects.toThrow(/em execução ou parada/i);
  });

  it("ajustar_estoque grava a diferença como um movimento de ajuste com sinal", async () => {
    const pecaId = await criarPeca(db, oficinaA.workshopId, oficinaA.usuarioId, "Óleo 5W30");
    await registrarEntrada(db, oficinaA.workshopId, oficinaA.usuarioId, pecaId, 10, 25);

    await asUser(db, oficinaA.usuarioId, (tx) =>
      tx.query(`select public.ajustar_estoque($1, $2, $3, $4)`, [
        pecaId,
        7,
        "Contagem de inventário",
        oficinaA.usuarioId,
      ])
    );

    const peca = await buscarPeca(db, pecaId);
    expect(peca.estoqueAtual).toBe(7);

    const { rows: movRows } = await db.query<{ tipo: string; quantidade: string }>(
      `select tipo, quantidade from public.movimentacao_estoque
       where peca_id = $1 and tipo = 'ajuste'`,
      [pecaId]
    );
    expect(Number(movRows[0].quantidade)).toBe(-3);
  });

  it("consumir e devolver: o saldo volta ao original e o ledger acumula os dois movimentos", async () => {
    const pecaId = await criarPeca(db, oficinaA.workshopId, oficinaA.usuarioId, "Amortecedor");
    await registrarEntrada(db, oficinaA.workshopId, oficinaA.usuarioId, pecaId, 6, 100);

    const ordemId = await abrirOrdemEmExecucao(
      db,
      oficinaA.workshopId,
      oficinaA.usuarioId,
      clienteVeiculoA.clienteId,
      clienteVeiculoA.veiculoId
    );

    await asUser(db, oficinaA.usuarioId, (tx) =>
      tx.query(`select public.consumir_peca_os($1, $2, $3, $4)`, [
        ordemId,
        pecaId,
        2,
        oficinaA.usuarioId,
      ])
    );
    await asUser(db, oficinaA.usuarioId, (tx) =>
      tx.query(
        `insert into public.movimentacao_estoque (workshop_id, peca_id, tipo, quantidade, created_by)
         values ($1, $2, 'devolucao', $3, $4)`,
        [oficinaA.workshopId, pecaId, 2, oficinaA.usuarioId]
      )
    );

    const peca = await buscarPeca(db, pecaId);
    expect(peca.estoqueAtual).toBe(6);

    const { rows: countRows } = await db.query<{ count: string }>(
      `select count(*) from public.movimentacao_estoque where peca_id = $1`,
      [pecaId]
    );
    expect(Number(countRows[0].count)).toBe(3); // entrada + saida_consumo + devolucao
  });

  it("CHECK de sinal rejeita entrada negativa e saída positiva", async () => {
    const pecaId = await criarPeca(db, oficinaA.workshopId, oficinaA.usuarioId, "Bateria 60Ah");

    await expect(
      asUser(db, oficinaA.usuarioId, (tx) =>
        tx.query(
          `insert into public.movimentacao_estoque (workshop_id, peca_id, tipo, quantidade, created_by)
           values ($1, $2, 'entrada', -1, $3)`,
          [oficinaA.workshopId, pecaId, oficinaA.usuarioId]
        )
      )
    ).rejects.toThrow();

    await expect(
      asUser(db, oficinaA.usuarioId, (tx) =>
        tx.query(
          `insert into public.movimentacao_estoque (workshop_id, peca_id, tipo, quantidade, created_by)
           values ($1, $2, 'saida_consumo', 1, $3)`,
          [oficinaA.workshopId, pecaId, oficinaA.usuarioId]
        )
      )
    ).rejects.toThrow();
  });

  it("ledger é imutável: sem policy de UPDATE/DELETE, RLS barra as duas operações (0 linhas afetadas)", async () => {
    const pecaId = await criarPeca(db, oficinaA.workshopId, oficinaA.usuarioId, "Disco de freio");
    await registrarEntrada(db, oficinaA.workshopId, oficinaA.usuarioId, pecaId, 4, 50);

    const { rows } = await db.query<{ id: string; observacao: string | null }>(
      `select id, observacao from public.movimentacao_estoque where peca_id = $1`,
      [pecaId]
    );
    const movimentacaoId = rows[0].id;

    // Sem policy de UPDATE/DELETE, o Postgres nega em vez de lançar erro:
    // a linha some da visão de escrita, então o comando afeta 0 linhas.
    const updateResult = await asUser(db, oficinaA.usuarioId, (tx) =>
      tx.query(`update public.movimentacao_estoque set observacao = 'fraude' where id = $1`, [
        movimentacaoId,
      ])
    );
    expect(updateResult.affectedRows ?? 0).toBe(0);

    const deleteResult = await asUser(db, oficinaA.usuarioId, (tx) =>
      tx.query(`delete from public.movimentacao_estoque where id = $1`, [movimentacaoId])
    );
    expect(deleteResult.affectedRows ?? 0).toBe(0);

    const { rows: depoisRows } = await db.query<{ observacao: string | null }>(
      `select observacao from public.movimentacao_estoque where id = $1`,
      [movimentacaoId]
    );
    expect(depoisRows).toHaveLength(1);
    expect(depoisRows[0].observacao).toBe(rows[0].observacao);
  });

  it("isolamento RLS: oficina B não enxerga peças nem movimentações da oficina A", async () => {
    const pecaId = await criarPeca(db, oficinaA.workshopId, oficinaA.usuarioId, "Junta do cabeçote");
    await registrarEntrada(db, oficinaA.workshopId, oficinaA.usuarioId, pecaId, 3, 60);

    const { rows: pecasRows } = await asUser(db, oficinaB.usuarioId, (tx) =>
      tx.query<{ id: string }>(`select id from public.peca where id = $1`, [pecaId])
    );
    expect(pecasRows).toHaveLength(0);

    const { rows: movRows } = await asUser(db, oficinaB.usuarioId, (tx) =>
      tx.query<{ workshop_id: string }>(`select workshop_id from public.movimentacao_estoque`)
    );
    expect(movRows.every((r) => r.workshop_id === oficinaB.workshopId)).toBe(true);
  });
});
