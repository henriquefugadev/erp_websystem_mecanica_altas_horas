import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asUser, createTestDb, seedWorkshopComUsuario } from "../helpers/db";

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

describe("Financeiro — categorias padrão", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createTestDb();
  });

  afterAll(async () => {
    await db.close();
  });

  it("cria as 10 categorias padrão automaticamente ao criar uma oficina", async () => {
    const { workshopId } = await seedWorkshopComUsuario(db, {
      workshopNome: "Oficina Nova",
      usuarioNome: "Dono",
      usuarioEmail: "dono@oficina-nova.example",
    });

    const { rows } = await db.query<{ tipo: string; count: string }>(
      `select tipo, count(*) from public.categoria_financeira where workshop_id = $1 group by tipo`,
      [workshopId]
    );

    const porTipo = Object.fromEntries(rows.map((r) => [r.tipo, Number(r.count)]));
    expect(porTipo.receita).toBe(3);
    expect(porTipo.despesa).toBe(7);
  });
});

describe("Financeiro — contas, parcelas e baixas", () => {
  let db: PGlite;
  let oficinaA: { workshopId: string; usuarioId: string };
  let oficinaB: { workshopId: string; usuarioId: string };
  let categoriaReceitaA: string;
  let categoriaDespesaA: string;

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

    categoriaReceitaA = await buscarCategoriaId(db, oficinaA.workshopId, "receita", "Mão de obra");
    categoriaDespesaA = await buscarCategoriaId(
      db,
      oficinaA.workshopId,
      "despesa",
      "Compra de peças"
    );
  });

  afterAll(async () => {
    await db.close();
  });

  it("criar_conta_financeira rejeita quando a soma das parcelas não bate com o valor total", async () => {
    await expect(
      asUser(db, oficinaA.usuarioId, (tx) =>
        tx.query(
          `select public.criar_conta_financeira($1,'receber','Revisão completa',$2,1500.00,'2026-07-01',null,null,null,$3,$4::jsonb)`,
          [
            oficinaA.workshopId,
            categoriaReceitaA,
            oficinaA.usuarioId,
            JSON.stringify([{ numero: 1, valor: 500, vencimento: "2026-07-15" }]),
          ]
        )
      )
    ).rejects.toThrow(/soma das parcelas/i);
  });

  it("criar_conta_financeira cria a conta e as parcelas atomicamente", async () => {
    const parcelas = [
      { numero: 1, valor: 500, vencimento: "2026-07-15" },
      { numero: 2, valor: 500, vencimento: "2026-08-15" },
      { numero: 3, valor: 500, vencimento: "2026-09-15" },
    ];

    const { rows } = await asUser(db, oficinaA.usuarioId, (tx) =>
      tx.query<{ criar_conta_financeira: string }>(
        `select public.criar_conta_financeira($1,'receber','Revisão completa',$2,1500.00,'2026-07-01',null,null,null,$3,$4::jsonb)`,
        [oficinaA.workshopId, categoriaReceitaA, oficinaA.usuarioId, JSON.stringify(parcelas)]
      )
    );
    const contaId = rows[0].criar_conta_financeira;

    const { rows: parcelaRows } = await asUser(db, oficinaA.usuarioId, (tx) =>
      tx.query<{ numero: number; valor: string; status: string }>(
        `select numero, valor, status from public.parcela_financeira where conta_id = $1 order by numero`,
        [contaId]
      )
    );

    expect(parcelaRows).toHaveLength(3);
    expect(parcelaRows.every((p) => p.status === "aberta")).toBe(true);
    expect(parcelaRows.map((p) => Number(p.valor))).toEqual([500, 500, 500]);
  });

  it("pagamento parcial deixa a parcela com status 'parcial' e o saldo correto", async () => {
    const { rows: contaRows } = await asUser(db, oficinaA.usuarioId, (tx) =>
      tx.query<{ id: string }>(
        `select public.criar_conta_financeira($1,'receber','Troca de óleo',$2,1000.00,'2026-08-01',null,null,null,$3,$4::jsonb) as id`,
        [
          oficinaA.workshopId,
          categoriaReceitaA,
          oficinaA.usuarioId,
          JSON.stringify([{ numero: 1, valor: 1000, vencimento: "2026-08-10" }]),
        ]
      )
    );
    const contaId = contaRows[0].id;
    const { rows: parcelaRows } = await db.query<{ id: string }>(
      `select id from public.parcela_financeira where conta_id = $1`,
      [contaId]
    );
    const parcelaId = parcelaRows[0].id;

    await asUser(db, oficinaA.usuarioId, (tx) =>
      tx.query(
        `select public.registrar_pagamento($1,600.00,0,'2026-08-05','pix',null,$2)`,
        [parcelaId, oficinaA.usuarioId]
      )
    );

    const { rows: statusRows } = await db.query<{
      status: string;
      valor: string;
      valor_pago: string;
    }>(`select status, valor, valor_pago from public.parcela_financeira where id = $1`, [
      parcelaId,
    ]);
    expect(statusRows[0].status).toBe("parcial");
    expect(Number(statusRows[0].valor) - Number(statusRows[0].valor_pago)).toBe(400);

    const { rows: contaStatusRows } = await db.query<{ status: string }>(
      `select status from public.conta_financeira where id = $1`,
      [contaId]
    );
    expect(contaStatusRows[0].status).toBe("parcial");

    // completa o pagamento
    await asUser(db, oficinaA.usuarioId, (tx) =>
      tx.query(`select public.registrar_pagamento($1,400.00,0,'2026-08-10','pix',null,$2)`, [
        parcelaId,
        oficinaA.usuarioId,
      ])
    );

    const { rows: finalRows } = await db.query<{ status: string }>(
      `select status from public.parcela_financeira where id = $1`,
      [parcelaId]
    );
    expect(finalRows[0].status).toBe("liquidada");

    const { rows: contaFinalRows } = await db.query<{ status: string }>(
      `select status from public.conta_financeira where id = $1`,
      [contaId]
    );
    expect(contaFinalRows[0].status).toBe("liquidada");
  });

  it("rejeita pagamento que excede o saldo em aberto", async () => {
    const { rows: contaRows } = await asUser(db, oficinaA.usuarioId, (tx) =>
      tx.query<{ id: string }>(
        `select public.criar_conta_financeira($1,'pagar','Compra de filtros',$2,500.00,'2026-07-01',null,'Distribuidora X',null,$3,$4::jsonb) as id`,
        [
          oficinaA.workshopId,
          categoriaDespesaA,
          oficinaA.usuarioId,
          JSON.stringify([{ numero: 1, valor: 500, vencimento: "2026-07-20" }]),
        ]
      )
    );
    const contaId = contaRows[0].id;
    const { rows: parcelaRows } = await db.query<{ id: string }>(
      `select id from public.parcela_financeira where conta_id = $1`,
      [contaId]
    );
    const parcelaId = parcelaRows[0].id;

    // paga só parte (400 de 500) — deixa R$100 de saldo em aberto
    await asUser(db, oficinaA.usuarioId, (tx) =>
      tx.query(`select public.registrar_pagamento($1,400.00,0,'2026-07-18','boleto',null,$2)`, [
        parcelaId,
        oficinaA.usuarioId,
      ])
    );

    // tenta pagar 200, mas só há R$100 de saldo
    await expect(
      asUser(db, oficinaA.usuarioId, (tx) =>
        tx.query(`select public.registrar_pagamento($1,200.00,0,'2026-07-19','dinheiro',null,$2)`, [
          parcelaId,
          oficinaA.usuarioId,
        ])
      )
    ).rejects.toThrow(/excede o saldo/i);
  });

  it("estorno reabre o saldo e o status da parcela e da conta", async () => {
    const { rows: contaRows } = await asUser(db, oficinaA.usuarioId, (tx) =>
      tx.query<{ id: string }>(
        `select public.criar_conta_financeira($1,'receber','Alinhamento',$2,300.00,'2026-07-01',null,null,null,$3,$4::jsonb) as id`,
        [
          oficinaA.workshopId,
          categoriaReceitaA,
          oficinaA.usuarioId,
          JSON.stringify([{ numero: 1, valor: 300, vencimento: "2026-07-10" }]),
        ]
      )
    );
    const contaId = contaRows[0].id;
    const { rows: parcelaRows } = await db.query<{ id: string }>(
      `select id from public.parcela_financeira where conta_id = $1`,
      [contaId]
    );
    const parcelaId = parcelaRows[0].id;

    const { rows: pagamentoRows } = await asUser(db, oficinaA.usuarioId, (tx) =>
      tx.query<{ id: string }>(
        `select public.registrar_pagamento($1,300.00,0,'2026-07-08','dinheiro',null,$2) as id`,
        [parcelaId, oficinaA.usuarioId]
      )
    );
    const pagamentoId = pagamentoRows[0].id;

    const { rows: liquidadaRows } = await db.query<{ status: string }>(
      `select status from public.parcela_financeira where id = $1`,
      [parcelaId]
    );
    expect(liquidadaRows[0].status).toBe("liquidada");

    await asUser(db, oficinaA.usuarioId, (tx) =>
      tx.query(`select public.estornar_pagamento($1,$2)`, [pagamentoId, oficinaA.usuarioId])
    );

    const { rows: reabertaRows } = await db.query<{
      status: string;
      valor_pago: string;
    }>(`select status, valor_pago from public.parcela_financeira where id = $1`, [parcelaId]);
    expect(reabertaRows[0].status).toBe("aberta");
    expect(Number(reabertaRows[0].valor_pago)).toBe(0);

    const { rows: contaReabertaRows } = await db.query<{ status: string }>(
      `select status from public.conta_financeira where id = $1`,
      [contaId]
    );
    expect(contaReabertaRows[0].status).toBe("aberta");

    await expect(
      asUser(db, oficinaA.usuarioId, (tx) =>
        tx.query(`select public.estornar_pagamento($1,$2)`, [pagamentoId, oficinaA.usuarioId])
      )
    ).rejects.toThrow(/já foi estornado/i);
  });

  it("financeiro_fluxo_caixa soma entradas e saídas pela data do pagamento (regime de caixa)", async () => {
    const { rows: contaReceberRows } = await asUser(db, oficinaA.usuarioId, (tx) =>
      tx.query<{ id: string }>(
        `select public.criar_conta_financeira($1,'receber','Fluxo A',$2,200.00,'2026-01-01',null,null,null,$3,$4::jsonb) as id`,
        [
          oficinaA.workshopId,
          categoriaReceitaA,
          oficinaA.usuarioId,
          JSON.stringify([{ numero: 1, valor: 200, vencimento: "2026-01-10" }]),
        ]
      )
    );
    const { rows: parcelaReceberRows } = await db.query<{ id: string }>(
      `select id from public.parcela_financeira where conta_id = $1`,
      [contaReceberRows[0].id]
    );
    await asUser(db, oficinaA.usuarioId, (tx) =>
      tx.query(`select public.registrar_pagamento($1,200.00,0,'2026-03-15','pix',null,$2)`, [
        parcelaReceberRows[0].id,
        oficinaA.usuarioId,
      ])
    );

    const { rows: contaPagarRows } = await asUser(db, oficinaA.usuarioId, (tx) =>
      tx.query<{ id: string }>(
        `select public.criar_conta_financeira($1,'pagar','Fluxo B',$2,80.00,'2026-01-01',null,'Fornecedor Y',null,$3,$4::jsonb) as id`,
        [
          oficinaA.workshopId,
          categoriaDespesaA,
          oficinaA.usuarioId,
          JSON.stringify([{ numero: 1, valor: 80, vencimento: "2026-01-10" }]),
        ]
      )
    );
    const { rows: parcelaPagarRows } = await db.query<{ id: string }>(
      `select id from public.parcela_financeira where conta_id = $1`,
      [contaPagarRows[0].id]
    );
    await asUser(db, oficinaA.usuarioId, (tx) =>
      tx.query(`select public.registrar_pagamento($1,80.00,0,'2026-03-15','dinheiro',null,$2)`, [
        parcelaPagarRows[0].id,
        oficinaA.usuarioId,
      ])
    );

    const { rows: fluxoRows } = await asUser(db, oficinaA.usuarioId, (tx) =>
      tx.query<{ dia: string; entradas: string; saidas: string }>(
        `select dia, entradas, saidas from public.financeiro_fluxo_caixa('2026-03-15','2026-03-15')`
      )
    );

    expect(fluxoRows).toHaveLength(1);
    expect(Number(fluxoRows[0].entradas)).toBe(200);
    expect(Number(fluxoRows[0].saidas)).toBe(80);

    // fora do período de vencimento original (jan) mas dentro do período de
    // pagamento (mar) — confirma que o fluxo usa data_pagamento, não vencimento.
    const { rows: foraDoPeriodoRows } = await asUser(db, oficinaA.usuarioId, (tx) =>
      tx.query<{ dia: string }>(
        `select dia from public.financeiro_fluxo_caixa('2026-01-01','2026-01-31')`
      )
    );
    expect(foraDoPeriodoRows.filter((r) => r.dia)).toEqual([]);
  });

  it("vw_inadimplencia lista parcelas vencidas e respeita isolamento por oficina", async () => {
    const { rows: contaRows } = await asUser(db, oficinaA.usuarioId, (tx) =>
      tx.query<{ id: string }>(
        `select public.criar_conta_financeira($1,'receber','Serviço vencido',$2,150.00,'2020-01-01',null,null,null,$3,$4::jsonb) as id`,
        [
          oficinaA.workshopId,
          categoriaReceitaA,
          oficinaA.usuarioId,
          JSON.stringify([{ numero: 1, valor: 150, vencimento: "2020-01-10" }]),
        ]
      )
    );
    const contaId = contaRows[0].id;

    const { rows: comoA } = await asUser(db, oficinaA.usuarioId, (tx) =>
      tx.query<{ conta_id: string; saldo: string; dias_atraso: number }>(
        `select conta_id, saldo, dias_atraso from public.vw_inadimplencia where conta_id = $1`,
        [contaId]
      )
    );
    expect(comoA).toHaveLength(1);
    expect(Number(comoA[0].saldo)).toBe(150);
    expect(comoA[0].dias_atraso).toBeGreaterThan(0);

    const { rows: comoB } = await asUser(db, oficinaB.usuarioId, (tx) =>
      tx.query(`select conta_id from public.vw_inadimplencia where conta_id = $1`, [contaId])
    );
    expect(comoB).toHaveLength(0);
  });

  it("isola categoria/conta/parcela/pagamento por workshop_id (RLS)", async () => {
    const { rows: minhasCategorias } = await asUser(db, oficinaB.usuarioId, (tx) =>
      tx.query(`select id from public.categoria_financeira where workshop_id = $1`, [
        oficinaA.workshopId,
      ])
    );
    expect(minhasCategorias).toHaveLength(0);

    const { rows: minhasContas } = await asUser(db, oficinaB.usuarioId, (tx) =>
      tx.query(`select id from public.conta_financeira where workshop_id = $1`, [
        oficinaA.workshopId,
      ])
    );
    expect(minhasContas).toHaveLength(0);

    await expect(
      asUser(db, oficinaB.usuarioId, (tx) =>
        tx.query(
          `insert into public.categoria_financeira (workshop_id, tipo, nome) values ($1, 'receita', 'Categoria forjada')`,
          [oficinaA.workshopId]
        )
      )
    ).rejects.toThrow();
  });
});
