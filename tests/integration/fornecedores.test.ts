import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asUser, createTestDb, seedWorkshopComUsuario } from "../helpers/db";

async function buscarCategoriaDespesaId(
  db: PGlite,
  workshopId: string,
  nome = "Compra de peças"
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `select id from public.categoria_financeira where workshop_id = $1 and tipo = 'despesa' and nome = $2`,
    [workshopId, nome]
  );
  return rows[0].id;
}

async function criarFornecedor(
  db: PGlite,
  workshopId: string,
  usuarioId: string,
  nome: string
): Promise<string> {
  const { rows } = await asUser(db, usuarioId, (tx) =>
    tx.query<{ id: string }>(
      `insert into public.fornecedor (workshop_id, nome, created_by) values ($1, $2, $3) returning id`,
      [workshopId, nome, usuarioId]
    )
  );
  return rows[0].id;
}

async function criarPedido(
  db: PGlite,
  workshopId: string,
  usuarioId: string,
  fornecedorId: string,
  categoriaId: string,
  itens: { descricao: string; quantidade: number; preco_unitario: number }[]
): Promise<string> {
  const { rows } = await asUser(db, usuarioId, (tx) =>
    tx.query<{ criar_pedido_compra: string }>(
      `select public.criar_pedido_compra($1,$2,$3,current_date,null,null,null,$4,$5::jsonb)`,
      [workshopId, fornecedorId, categoriaId, usuarioId, JSON.stringify(itens)]
    )
  );
  return rows[0].criar_pedido_compra;
}

async function itensDoPedido(db: PGlite, pedidoId: string) {
  const { rows } = await db.query<{
    id: string;
    descricao: string;
    quantidade: string;
    quantidade_recebida: string;
  }>(
    `select id, descricao, quantidade, quantidade_recebida from public.pedido_compra_item
     where pedido_id = $1 order by descricao`,
    [pedidoId]
  );
  return rows;
}

describe("Fornecedores e Compras", () => {
  let db: PGlite;
  let oficinaA: { workshopId: string; usuarioId: string };
  let oficinaB: { workshopId: string; usuarioId: string };
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

    categoriaDespesaA = await buscarCategoriaDespesaId(db, oficinaA.workshopId);
  });

  afterAll(async () => {
    await db.close();
  });

  it("cadastra fornecedor e funcionário com isolamento por oficina (RLS)", async () => {
    const fornecedorA = await criarFornecedor(db, oficinaA.workshopId, oficinaA.usuarioId, "Autopeças Silva");

    const { rows: comoB } = await asUser(db, oficinaB.usuarioId, (tx) =>
      tx.query<{ id: string }>(`select id from public.fornecedor where id = $1`, [fornecedorA])
    );
    expect(comoB).toHaveLength(0);

    const { rows: funcionarioRows } = await asUser(db, oficinaA.usuarioId, (tx) =>
      tx.query<{ id: string; ativo: boolean }>(
        `insert into public.funcionario (workshop_id, nome, funcao, created_by)
         values ($1, 'Zé Mecânico', 'Mecânico', $2) returning id, ativo`,
        [oficinaA.workshopId, oficinaA.usuarioId]
      )
    );
    expect(funcionarioRows[0].ativo).toBe(true);
  });

  it("bloqueia INSERT de fornecedor com workshop_id de outra oficina (anti-spoofing)", async () => {
    await expect(
      asUser(db, oficinaA.usuarioId, (tx) =>
        tx.query(`insert into public.fornecedor (workshop_id, nome) values ($1, 'Forjado')`, [
          oficinaB.workshopId,
        ])
      )
    ).rejects.toThrow();
  });

  it("criar_pedido_compra numera sequencialmente por oficina e cria os itens", async () => {
    const fornecedorId = await criarFornecedor(db, oficinaA.workshopId, oficinaA.usuarioId, "Fornecedor 1");

    const pedidoId = await criarPedido(db, oficinaA.workshopId, oficinaA.usuarioId, fornecedorId, categoriaDespesaA, [
      { descricao: "Filtro de óleo", quantidade: 4, preco_unitario: 25 },
      { descricao: "Filtro de ar", quantidade: 2, preco_unitario: 40 },
    ]);

    const { rows } = await db.query<{ numero: number; status: string }>(
      `select numero, status from public.pedido_compra where id = $1`,
      [pedidoId]
    );
    expect(rows[0].status).toBe("aberto");
    expect(rows[0].numero).toBeGreaterThan(0);

    const itens = await itensDoPedido(db, pedidoId);
    expect(itens).toHaveLength(2);
    expect(itens.map((i) => i.descricao)).toEqual(["Filtro de ar", "Filtro de óleo"]);
  });

  it("rejeita criar pedido sem itens", async () => {
    const fornecedorId = await criarFornecedor(db, oficinaA.workshopId, oficinaA.usuarioId, "Fornecedor Sem Itens");

    await expect(
      criarPedido(db, oficinaA.workshopId, oficinaA.usuarioId, fornecedorId, categoriaDespesaA, [])
    ).rejects.toThrow(/ao menos um item/i);
  });

  it("recebimento parcial: gera conta a pagar só do valor recebido e deixa o pedido 'parcial'", async () => {
    const fornecedorId = await criarFornecedor(db, oficinaA.workshopId, oficinaA.usuarioId, "Fornecedor Parcial");
    const pedidoId = await criarPedido(db, oficinaA.workshopId, oficinaA.usuarioId, fornecedorId, categoriaDespesaA, [
      { descricao: "Pastilha de freio", quantidade: 10, preco_unitario: 30 },
    ]);
    const [item] = await itensDoPedido(db, pedidoId);

    const { rows: recebimentoRows } = await asUser(db, oficinaA.usuarioId, (tx) =>
      tx.query<{ receber_pedido_compra: string }>(
        `select public.receber_pedido_compra($1,$2::jsonb,current_date,'2026-08-15',null,$3)`,
        [
          pedidoId,
          JSON.stringify([{ pedido_item_id: item.id, quantidade: 6 }]),
          oficinaA.usuarioId,
        ]
      )
    );
    const recebimentoId = recebimentoRows[0].receber_pedido_compra;

    const { rows: pedidoRows } = await db.query<{ status: string }>(
      `select status from public.pedido_compra where id = $1`,
      [pedidoId]
    );
    expect(pedidoRows[0].status).toBe("parcial");

    const { rows: recebimentoCompraRows } = await db.query<{ conta_id: string | null }>(
      `select conta_id from public.recebimento_compra where id = $1`,
      [recebimentoId]
    );
    expect(recebimentoCompraRows[0].conta_id).not.toBeNull();

    const { rows: contaRows } = await db.query<{
      tipo: string;
      valor_total: string;
      fornecedor_id: string;
      fornecedor_nome: string;
      status: string;
    }>(
      `select tipo, valor_total, fornecedor_id, fornecedor_nome, status from public.conta_financeira where id = $1`,
      [recebimentoCompraRows[0].conta_id]
    );
    expect(contaRows[0].tipo).toBe("pagar");
    expect(Number(contaRows[0].valor_total)).toBe(180); // 6 * 30
    expect(contaRows[0].fornecedor_id).toBe(fornecedorId);
    expect(contaRows[0].fornecedor_nome).toBe("Fornecedor Parcial");

    const { rows: itemRows } = await db.query<{ quantidade_recebida: string }>(
      `select quantidade_recebida from public.pedido_compra_item where id = $1`,
      [item.id]
    );
    expect(Number(itemRows[0].quantidade_recebida)).toBe(6);
  });

  it("recebimento completo: pedido vira 'recebido' e novo recebimento gera 2ª conta a pagar", async () => {
    const fornecedorId = await criarFornecedor(db, oficinaA.workshopId, oficinaA.usuarioId, "Fornecedor Completo");
    const pedidoId = await criarPedido(db, oficinaA.workshopId, oficinaA.usuarioId, fornecedorId, categoriaDespesaA, [
      { descricao: "Óleo 5W30", quantidade: 5, preco_unitario: 50 },
    ]);
    const [item] = await itensDoPedido(db, pedidoId);

    await asUser(db, oficinaA.usuarioId, (tx) =>
      tx.query(`select public.receber_pedido_compra($1,$2::jsonb,current_date,'2026-08-15',null,$3)`, [
        pedidoId,
        JSON.stringify([{ pedido_item_id: item.id, quantidade: 2 }]),
        oficinaA.usuarioId,
      ])
    );
    await asUser(db, oficinaA.usuarioId, (tx) =>
      tx.query(`select public.receber_pedido_compra($1,$2::jsonb,current_date,'2026-08-20',null,$3)`, [
        pedidoId,
        JSON.stringify([{ pedido_item_id: item.id, quantidade: 3 }]),
        oficinaA.usuarioId,
      ])
    );

    const { rows: pedidoRows } = await db.query<{ status: string }>(
      `select status from public.pedido_compra where id = $1`,
      [pedidoId]
    );
    expect(pedidoRows[0].status).toBe("recebido");

    const { rows: contasRows } = await db.query<{ count: string }>(
      `select count(*) from public.conta_financeira where fornecedor_id = $1`,
      [fornecedorId]
    );
    expect(Number(contasRows[0].count)).toBe(2);
  });

  it("bloqueia sobre-recebimento (quantidade maior que o saldo pendente)", async () => {
    const fornecedorId = await criarFornecedor(db, oficinaA.workshopId, oficinaA.usuarioId, "Fornecedor Excesso");
    const pedidoId = await criarPedido(db, oficinaA.workshopId, oficinaA.usuarioId, fornecedorId, categoriaDespesaA, [
      { descricao: "Correia dentada", quantidade: 3, preco_unitario: 60 },
    ]);
    const [item] = await itensDoPedido(db, pedidoId);

    await expect(
      asUser(db, oficinaA.usuarioId, (tx) =>
        tx.query(`select public.receber_pedido_compra($1,$2::jsonb,current_date,'2026-08-15',null,$3)`, [
          pedidoId,
          JSON.stringify([{ pedido_item_id: item.id, quantidade: 4 }]),
          oficinaA.usuarioId,
        ])
      )
    ).rejects.toThrow(/excede o saldo pendente/i);
  });

  it("cancela um pedido 'aberto' e bloqueia recebimento depois de cancelado", async () => {
    const fornecedorId = await criarFornecedor(db, oficinaA.workshopId, oficinaA.usuarioId, "Fornecedor Cancelado");
    const pedidoId = await criarPedido(db, oficinaA.workshopId, oficinaA.usuarioId, fornecedorId, categoriaDespesaA, [
      { descricao: "Vela de ignição", quantidade: 4, preco_unitario: 15 },
    ]);
    const [item] = await itensDoPedido(db, pedidoId);

    await asUser(db, oficinaA.usuarioId, (tx) =>
      tx.query(`update public.pedido_compra set status = 'cancelado' where id = $1`, [pedidoId])
    );

    await expect(
      asUser(db, oficinaA.usuarioId, (tx) =>
        tx.query(`select public.receber_pedido_compra($1,$2::jsonb,current_date,'2026-08-15',null,$3)`, [
          pedidoId,
          JSON.stringify([{ pedido_item_id: item.id, quantidade: 1 }]),
          oficinaA.usuarioId,
        ])
      )
    ).rejects.toThrow(/não é possível registrar recebimento/i);
  });

  it("isolamento RLS: oficina B não enxerga pedidos de compra da oficina A", async () => {
    const { rows } = await asUser(db, oficinaB.usuarioId, (tx) =>
      tx.query<{ workshop_id: string }>(`select workshop_id from public.pedido_compra`)
    );
    expect(rows.every((r) => r.workshop_id === oficinaB.workshopId)).toBe(true);
  });
});
