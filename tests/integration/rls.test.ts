import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asUser, createTestDb, seedWorkshopComUsuario } from "../helpers/db";

describe("RLS multi-tenant — cliente/veiculo/auditoria", () => {
  let db: PGlite;
  let oficinaA: { workshopId: string; usuarioId: string };
  let oficinaB: { workshopId: string; usuarioId: string };
  let clienteA: string;
  let clienteB: string;

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

    const { rows: rowsA } = await db.query<{ id: string }>(
      `insert into public.cliente
         (workshop_id, tipo, nome, documento, telefone, cep, logradouro, numero, bairro, cidade, estado, created_by)
       values ($1, 'PF', 'Cliente da Oficina A', '52998224725', '11912345678', '01001000', 'Praça da Sé', '100', 'Sé', 'São Paulo', 'SP', $2)
       returning id`,
      [oficinaA.workshopId, oficinaA.usuarioId]
    );
    clienteA = rowsA[0].id;

    const { rows: rowsB } = await db.query<{ id: string }>(
      `insert into public.cliente
         (workshop_id, tipo, nome, documento, telefone, cep, logradouro, numero, bairro, cidade, estado, created_by)
       values ($1, 'PF', 'Cliente da Oficina B', '11144477735', '11987654321', '01001000', 'Praça da Sé', '200', 'Sé', 'São Paulo', 'SP', $2)
       returning id`,
      [oficinaB.workshopId, oficinaB.usuarioId]
    );
    clienteB = rowsB[0].id;
  });

  afterAll(async () => {
    await db.close();
  });

  it("usuário da oficina A só enxerga clientes da própria oficina", async () => {
    const { rows } = await asUser(db, oficinaA.usuarioId, (tx) =>
      tx.query<{ id: string }>(`select id from public.cliente order by nome`)
    );

    expect(rows.map((r) => r.id)).toEqual([clienteA]);
  });

  it("usuário da oficina B só enxerga clientes da própria oficina", async () => {
    const { rows } = await asUser(db, oficinaB.usuarioId, (tx) =>
      tx.query<{ id: string }>(`select id from public.cliente order by nome`)
    );

    expect(rows.map((r) => r.id)).toEqual([clienteB]);
  });

  it("bloqueia INSERT de cliente com workshop_id de outra oficina (anti-spoofing)", async () => {
    await expect(
      asUser(db, oficinaA.usuarioId, (tx) =>
        tx.query(
          `insert into public.cliente
             (workshop_id, tipo, nome, documento, telefone, cep, logradouro, numero, bairro, cidade, estado)
           values ($1, 'PF', 'Cliente Forjado', '11144477735', '11912345678', '01001000', 'Rua X', '1', 'Bairro', 'Cidade', 'SP')`,
          [oficinaB.workshopId]
        )
      )
    ).rejects.toThrow();
  });

  it("UPDATE em cliente de outra oficina não afeta nenhuma linha", async () => {
    const result = await asUser(db, oficinaA.usuarioId, (tx) =>
      tx.query(`update public.cliente set nome = 'Hackeado' where id = $1`, [
        clienteB,
      ])
    );

    expect(result.affectedRows ?? 0).toBe(0);

    const { rows } = await db.query<{ nome: string }>(
      `select nome from public.cliente where id = $1`,
      [clienteB]
    );
    expect(rows[0].nome).toBe("Cliente da Oficina B");
  });

  it("DELETE é bloqueado por RLS mesmo tendo GRANT de tabela (só soft delete é permitido)", async () => {
    // Sem policy de DELETE, o comando roda (há GRANT de tabela) mas o USING
    // implícito nega todas as linhas: afeta 0 registros, sem erro — é assim
    // que o Postgres nega por RLS em comandos que usam USING (SELECT/UPDATE/
    // DELETE). Só o INSERT falha com erro, por usar WITH CHECK.
    const result = await asUser(db, oficinaA.usuarioId, (tx) =>
      tx.query(`delete from public.cliente where id = $1`, [clienteA])
    );
    expect(result.affectedRows ?? 0).toBe(0);

    const { rows } = await db.query<{ deleted_at: string | null }>(
      `select deleted_at from public.cliente where id = $1`,
      [clienteA]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].deleted_at).toBeNull();
  });

  it("soft delete via UPDATE deleted_at funciona e mantém isolamento", async () => {
    await asUser(db, oficinaA.usuarioId, (tx) =>
      tx.query(`update public.cliente set deleted_at = now() where id = $1`, [
        clienteA,
      ])
    );

    const { rows } = await db.query<{ deleted_at: string | null }>(
      `select deleted_at from public.cliente where id = $1`,
      [clienteA]
    );
    expect(rows[0].deleted_at).not.toBeNull();

    // reverte para não afetar os demais testes desta suíte
    await db.query(`update public.cliente set deleted_at = null where id = $1`, [
      clienteA,
    ]);
  });

  it("veículo segue o mesmo isolamento por workshop_id", async () => {
    const { rows: veiculoRows } = await db.query<{ id: string }>(
      `insert into public.veiculo (workshop_id, cliente_id, placa, modelo)
       values ($1, $2, 'ABC1234', 'Palio') returning id`,
      [oficinaB.workshopId, clienteB]
    );
    const veiculoB = veiculoRows[0].id;

    const { rows: comoA } = await asUser(db, oficinaA.usuarioId, (tx) =>
      tx.query<{ id: string }>(`select id from public.veiculo where id = $1`, [
        veiculoB,
      ])
    );
    expect(comoA).toHaveLength(0);

    const { rows: comoB } = await asUser(db, oficinaB.usuarioId, (tx) =>
      tx.query<{ id: string }>(`select id from public.veiculo where id = $1`, [
        veiculoB,
      ])
    );
    expect(comoB).toHaveLength(1);
  });

  it("trigger de auditoria registra INSERT/UPDATE e respeita isolamento por workshop", async () => {
    const { rows } = await asUser(db, oficinaA.usuarioId, (tx) =>
      tx.query<{ acao: string; tabela: string }>(
        `select acao, tabela from public.auditoria where registro_id = $1 order by instante`,
        [clienteA]
      )
    );

    const acoes = rows.map((r) => r.acao);
    expect(acoes).toContain("INSERT");
    expect(acoes).toContain("UPDATE"); // soft delete e reversão geraram updates
    expect(rows.every((r) => r.tabela === "cliente")).toBe(true);
  });

  it("usuário da oficina A não vê auditoria da oficina B", async () => {
    const { rows } = await asUser(db, oficinaA.usuarioId, (tx) =>
      tx.query(`select id from public.auditoria where registro_id = $1`, [
        clienteB,
      ])
    );
    expect(rows).toHaveLength(0);
  });

  it("INSERT direto em auditoria pelo role authenticated é bloqueado (só a trigger pode gravar)", async () => {
    await expect(
      asUser(db, oficinaA.usuarioId, (tx) =>
        tx.query(
          `insert into public.auditoria (workshop_id, tabela, registro_id, acao)
           values ($1, 'cliente', $2, 'INSERT')`,
          [oficinaA.workshopId, clienteA]
        )
      )
    ).rejects.toThrow();
  });
});
