// Sobe os arquivos originais do historico para o Supabase Storage, no mesmo
// layout que `ordem_servico.import_arquivo` / `orcamento.import_arquivo`
// gravam ("<pasta>/<arquivo>") — e o que faz o link do registro para o PDF
// funcionar.
//
//   node scripts/upload-historico.mjs --dry-run   # lista sem enviar
//   node scripts/upload-historico.mjs             # envia de verdade
//
// Precisa de SUPABASE_SERVICE_ROLE_KEY no .env.local (Storage exige escrita).
// O bucket e criado PRIVADO: os arquivos tem dado de cliente.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const RAIZ =
  "C:/Users/henri/Downloads/ARQUIVOS PRO HENRIQUE FUGA/ARQUIVOS PRO HENRIQUE FUGA/Arquivos Importantes";
const BUCKET = "historico";

// Pastas aprovadas para upload. "01" guarda as planilhas .xlsx de onde saiu a
// maior parte das OS — sem ela, ~200 registros apontam para um arquivo que nao
// esta no Storage. Descomente se quiser fechar essa lacuna (+2,7 MB).
const PASTAS = [
  "02 - Orcamentos",
  "03 - Ordens de Servico",
  // "01 - Clientes e Cadastros",
];

const dryRun = process.argv.includes("--dry-run");

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf-8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || (!key && !dryRun)) {
  console.error(
    "Falta NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env.local.\n" +
      "A chave de servico e obrigatoria para escrever no Storage."
  );
  process.exit(1);
}

const tipo = (f) =>
  ({ ".pdf": "application/pdf", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".doc": "application/msword", ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }[
    path.extname(f).toLowerCase()
  ] ?? "application/octet-stream");

const alvos = [];
for (const pasta of PASTAS) {
  const dir = path.join(RAIZ, pasta);
  for (const nome of readdirSync(dir)) {
    const full = path.join(dir, nome);
    if (!statSync(full).isFile() || nome.startsWith("~$")) continue;
    alvos.push({ full, destino: `${pasta}/${nome}`, bytes: statSync(full).size });
  }
}
const total = alvos.reduce((s, a) => s + a.bytes, 0);
console.log(`${alvos.length} arquivos, ${(total / 1024 / 1024).toFixed(1)} MB`);
for (const p of PASTAS) {
  const g = alvos.filter((a) => a.destino.startsWith(p));
  console.log(`  ${p}: ${g.length} arquivos, ${(g.reduce((s, a) => s + a.bytes, 0) / 1024 / 1024).toFixed(1)} MB`);
}
if (dryRun) {
  console.log("\n--dry-run: nada foi enviado.");
  process.exit(0);
}

const sb = createClient(url, key, { auth: { persistSession: false } });
const { data: buckets } = await sb.storage.listBuckets();
if (!buckets?.some((b) => b.name === BUCKET)) {
  const { error } = await sb.storage.createBucket(BUCKET, { public: false });
  if (error) { console.error(`nao consegui criar o bucket: ${error.message}`); process.exit(1); }
  console.log(`bucket '${BUCKET}' criado (privado)`);
}

let ok = 0, falhou = 0;
for (const a of alvos) {
  const { error } = await sb.storage
    .from(BUCKET)
    .upload(a.destino, readFileSync(a.full), { contentType: tipo(a.full), upsert: true });
  if (error) { falhou++; console.error(`  FALHOU ${a.destino}: ${error.message}`); }
  else { ok++; if (ok % 25 === 0) console.log(`  ${ok}/${alvos.length}...`); }
}
console.log(`\nenviados: ${ok} | falhas: ${falhou}`);
