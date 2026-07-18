import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(here, "../../supabase/migrations");

export type Db = PGlite;

export async function createTestDb(): Promise<PGlite> {
  const db = await PGlite.create({ extensions: { unaccent } });
  const shim = readFileSync(path.join(here, "supabase-shim.sql"), "utf-8");
  await db.exec(shim);

  // Aplica todas as migrações em ordem (0001_..., 0002_..., ...) — mesma
  // sequência que rodaria contra o Supabase real.
  const arquivos = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const arquivo of arquivos) {
    const migration = readFileSync(path.join(migrationsDir, arquivo), "utf-8");
    await db.exec(migration);
  }

  return db;
}

/**
 * Roda `fn` dentro de uma transação com `role` e `request.jwt.claim.sub`
 * setados via SET LOCAL — reproduz exatamente como o PostgREST/Supabase
 * autentica uma requisição, para que as RLS policies sejam avaliadas de
 * verdade (não como o superusuário de conexão, que sempre ignora RLS).
 */
export async function asUser<T>(
  db: PGlite,
  userId: string,
  fn: (tx: Transaction) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query(
      `select set_config('role', 'authenticated', true), set_config('request.jwt.claim.sub', $1, true)`,
      [userId]
    );
    return fn(tx);
  });
}

export async function seedWorkshopComUsuario(
  db: PGlite,
  params: { workshopNome: string; usuarioNome: string; usuarioEmail: string }
) {
  const { rows: workshopRows } = await db.query<{ id: string }>(
    `insert into public.workshop (nome) values ($1) returning id`,
    [params.workshopNome]
  );
  const workshopId = workshopRows[0].id;

  // auth.users tem uma trigger (on_auth_user_created) que já cria a linha
  // correspondente em public.usuario — não inserir manualmente ali.
  const { rows: authUserRows } = await db.query<{ id: string }>(
    `insert into auth.users (email, raw_user_meta_data) values ($1, jsonb_build_object('nome', $2::text)) returning id`,
    [params.usuarioEmail, params.usuarioNome]
  );
  const usuarioId = authUserRows[0].id;

  await db.query(
    `insert into public.usuario_workshop (usuario_id, workshop_id, papel) values ($1, $2, 'gerente')`,
    [usuarioId, workshopId]
  );

  return { workshopId, usuarioId };
}
