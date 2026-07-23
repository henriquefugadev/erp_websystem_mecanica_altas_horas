import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asUser, createTestDb, seedWorkshopComUsuario } from "../helpers/db";

describe("RLS — workshop (configurações restritas a admin)", () => {
  let db: PGlite;
  let workshopId: string;
  let gerenteId: string;
  let adminId: string;

  beforeAll(async () => {
    db = await createTestDb();

    const oficina = await seedWorkshopComUsuario(db, {
      workshopNome: "Mecânica Altas Horas",
      usuarioNome: "Michele",
      usuarioEmail: "michele@altashoras.example",
    });
    workshopId = oficina.workshopId;
    gerenteId = oficina.usuarioId;

    const { rows } = await db.query<{ id: string }>(
      `insert into auth.users (email, raw_user_meta_data) values ($1, jsonb_build_object('nome', $2::text)) returning id`,
      ["jadson@altashoras.example", "Jadson"]
    );
    adminId = rows[0].id;
    await db.query(
      `insert into public.usuario_workshop (usuario_id, workshop_id, papel) values ($1, $2, 'admin')`,
      [adminId, workshopId]
    );
  });

  afterAll(async () => {
    await db.close();
  });

  it("gerente lê a configuração da oficina mas não consegue atualizar (0 linhas afetadas)", async () => {
    const result = await asUser(db, gerenteId, (tx) =>
      tx.query(`update public.workshop set cnpj = '11222333000181' where id = $1`, [
        workshopId,
      ])
    );
    expect(result.affectedRows ?? 0).toBe(0);

    const { rows } = await asUser(db, gerenteId, (tx) =>
      tx.query<{ cnpj: string | null }>(
        `select cnpj from public.workshop where id = $1`,
        [workshopId]
      )
    );
    expect(rows[0].cnpj).toBeNull();
  });

  it("admin consegue atualizar os dados fiscais da oficina", async () => {
    await asUser(db, adminId, (tx) =>
      tx.query(
        `update public.workshop
         set cnpj = '11222333000181', razao_social = 'Altas Horas Mecânica Ltda'
         where id = $1`,
        [workshopId]
      )
    );

    const { rows } = await asUser(db, adminId, (tx) =>
      tx.query<{ cnpj: string | null; razao_social: string | null }>(
        `select cnpj, razao_social from public.workshop where id = $1`,
        [workshopId]
      )
    );
    expect(rows[0].cnpj).toBe("11222333000181");
    expect(rows[0].razao_social).toBe("Altas Horas Mecânica Ltda");
  });

  it("trigger de auditoria registra a atualização feita pelo admin", async () => {
    const { rows } = await asUser(db, adminId, (tx) =>
      tx.query<{ acao: string }>(
        `select acao from public.auditoria where registro_id = $1 and tabela = 'workshop' order by instante`,
        [workshopId]
      )
    );
    expect(rows.map((r) => r.acao)).toContain("UPDATE");
  });
});
