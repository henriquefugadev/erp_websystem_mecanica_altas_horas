import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asUser, createTestDb, seedWorkshopComUsuario } from "../helpers/db";

// Fase 1 (entrada rápida): valida os afrouxamentos da migração 0012 —
// cliente sem documento/endereço, OS sem queixa, e busca casando por placa.
describe("Entrada rápida — recepção", () => {
  let db: PGlite;
  let oficina: { workshopId: string; usuarioId: string };

  beforeAll(async () => {
    db = await createTestDb();
    oficina = await seedWorkshopComUsuario(db, {
      workshopNome: "Mecânica Altas Horas",
      usuarioNome: "Michele",
      usuarioEmail: "michele@altashoras.example",
    });
  });

  afterAll(async () => {
    await db.close();
  });

  async function criarClienteRapido(nome: string, telefone: string) {
    const { rows } = await asUser(db, oficina.usuarioId, (tx) =>
      tx.query<{ id: string }>(
        `insert into public.cliente (workshop_id, tipo, nome, telefone, created_by)
         values ($1, 'PF', $2, $3, $4) returning id`,
        [oficina.workshopId, nome, telefone, oficina.usuarioId]
      )
    );
    return rows[0].id;
  }

  it("cria cliente só com nome e telefone (documento/endereço nulos)", async () => {
    const id = await criarClienteRapido("João da Recepção", "64999990001");
    const { rows } = await db.query<{ documento: string | null; cep: string | null }>(
      `select documento, cep from public.cliente where id = $1`,
      [id]
    );
    expect(rows[0].documento).toBeNull();
    expect(rows[0].cep).toBeNull();
  });

  it("permite dois clientes sem documento na mesma oficina (índice único parcial)", async () => {
    await criarClienteRapido("Sem Doc Um", "64999990002");
    await expect(criarClienteRapido("Sem Doc Dois", "64999990003")).resolves.toBeTypeOf("string");
  });

  it("abre OS sem queixa (cliente só larga o carro)", async () => {
    const clienteId = await criarClienteRapido("Dono do Gol", "64999990004");
    const { rows: veic } = await asUser(db, oficina.usuarioId, (tx) =>
      tx.query<{ id: string }>(
        `insert into public.veiculo (workshop_id, cliente_id, placa, modelo)
         values ($1, $2, 'RTK1A23', 'Gol') returning id`,
        [oficina.workshopId, clienteId]
      )
    );

    const { rows } = await asUser(db, oficina.usuarioId, (tx) =>
      tx.query<{ status: string; queixa: string | null }>(
        `insert into public.ordem_servico (workshop_id, cliente_id, veiculo_id, created_by)
         values ($1, $2, $3, $4) returning status, queixa`,
        [oficina.workshopId, clienteId, veic[0].id, oficina.usuarioId]
      )
    );
    expect(rows[0].queixa).toBeNull();
    expect(rows[0].status).toBe("aguardando");
  });

  it("buscar_clientes_veiculos casa por placa, com ou sem hífen", async () => {
    const clienteId = await criarClienteRapido("Maria da Placa", "64999990005");
    await asUser(db, oficina.usuarioId, (tx) =>
      tx.query(
        `insert into public.veiculo (workshop_id, cliente_id, placa, modelo)
         values ($1, $2, 'ABC1234', 'Onix')`,
        [oficina.workshopId, clienteId]
      )
    );

    for (const termo of ["ABC1234", "abc-1234", "ABC"]) {
      const { rows } = await asUser(db, oficina.usuarioId, (tx) =>
        tx.query<{ id: string }>(`select id from public.buscar_clientes_veiculos($1)`, [termo])
      );
      expect(rows.map((r) => r.id)).toContain(clienteId);
    }
  });

  it("buscar_clientes_veiculos ainda casa por nome (tolerante a acento)", async () => {
    const clienteId = await criarClienteRapido("José Antônio", "64999990006");
    const { rows } = await asUser(db, oficina.usuarioId, (tx) =>
      tx.query<{ id: string }>(`select id from public.buscar_clientes_veiculos($1)`, ["jose antonio"])
    );
    expect(rows.map((r) => r.id)).toContain(clienteId);
  });
});
