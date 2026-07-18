import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

const BUCKET = "veiculo-fotos";

function caminhoBase(workshopId: string, veiculoId: string) {
  return `${workshopId}/${veiculoId}`;
}

export async function listarFotos(
  supabase: Client,
  workshopId: string,
  veiculoId: string
) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(caminhoBase(workshopId, veiculoId), {
      sortBy: { column: "created_at", order: "desc" },
    });

  if (error) throw error;

  // Bucket é privado (RLS controla acesso por workshop_id) — precisa de
  // signed URL, getPublicUrl() não funciona aqui.
  const caminhos = (data ?? []).map(
    (arquivo) => `${caminhoBase(workshopId, veiculoId)}/${arquivo.name}`
  );
  if (caminhos.length === 0) return [];

  const { data: assinadas, error: erroAssinatura } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(caminhos, 60 * 60); // 1h

  if (erroAssinatura) throw erroAssinatura;

  return assinadas
    .map((item, i) => ({
      nome: data![i].name,
      path: caminhos[i],
      url: item.signedUrl,
    }))
    .filter((foto): foto is { nome: string; path: string; url: string } =>
      Boolean(foto.url)
    );
}

export async function enviarFoto(
  supabase: Client,
  workshopId: string,
  veiculoId: string,
  arquivo: File
) {
  const extensao = arquivo.name.split(".").pop() ?? "jpg";
  const nomeArquivo = `${crypto.randomUUID()}.${extensao}`;
  const path = `${caminhoBase(workshopId, veiculoId)}/${nomeArquivo}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, arquivo, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) throw error;
  return path;
}

export async function removerFoto(supabase: Client, path: string) {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}
