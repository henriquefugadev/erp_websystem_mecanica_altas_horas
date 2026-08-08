import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { WorkshopInput } from "@/lib/validators/workshop.schema";

type Client = SupabaseClient<Database>;

const BUCKET_LOGO = "workshop-logo";

export async function buscarConfiguracao(supabase: Client, workshopId: string) {
  const { data, error } = await supabase
    .from("workshop")
    .select("*")
    .eq("id", workshopId)
    .single();

  if (error) throw error;
  return data;
}

export async function atualizarConfiguracao(
  supabase: Client,
  workshopId: string,
  dados: WorkshopInput
) {
  const { data, error } = await supabase
    .from("workshop")
    .update({
      nome: dados.nome,
      razao_social: dados.razaoSocial || null,
      cnpj: dados.cnpj || null,
      telefone: dados.telefone || null,
      email: dados.email || null,
      cep: dados.cep || null,
      logradouro: dados.logradouro || null,
      numero: dados.numero || null,
      complemento: dados.complemento || null,
      bairro: dados.bairro || null,
      cidade: dados.cidade || null,
      estado: dados.estado || null,
      condicoes_pagamento_padrao: dados.condicoesPagamentoPadrao || null,
      validade_orcamento_dias: dados.validadeOrcamentoDias,
      markup_peca_percentual: dados.markupPecaPercentual,
      valor_hora_mao_obra: dados.valorHoraMaoObra,
      markup_habilitado: dados.markupHabilitado,
      nav_ocultos: dados.navOcultos,
    })
    .eq("id", workshopId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Logo é 1 arquivo por oficina — upsert sempre sobrescreve o mesmo path, sem
// acumular versões antigas (diferente do padrão de várias fotos por veículo).
export async function enviarLogo(supabase: Client, workshopId: string, arquivo: File) {
  const extensao = arquivo.name.split(".").pop() ?? "png";
  const path = `${workshopId}/logo.${extensao}`;

  const { error: erroUpload } = await supabase.storage
    .from(BUCKET_LOGO)
    .upload(path, arquivo, { cacheControl: "3600", upsert: true });
  if (erroUpload) throw erroUpload;

  const { error: erroUpdate } = await supabase
    .from("workshop")
    .update({ logo_path: path })
    .eq("id", workshopId);
  if (erroUpdate) throw erroUpdate;

  return path;
}

export async function removerLogo(supabase: Client, workshopId: string, path: string) {
  const { error: erroRemove } = await supabase.storage.from(BUCKET_LOGO).remove([path]);
  if (erroRemove) throw erroRemove;

  const { error: erroUpdate } = await supabase
    .from("workshop")
    .update({ logo_path: null })
    .eq("id", workshopId);
  if (erroUpdate) throw erroUpdate;
}

export async function obterUrlLogo(supabase: Client, path: string) {
  // Bucket é privado (RLS controla acesso por workshop_id) — precisa de
  // signed URL, getPublicUrl() não funciona aqui.
  const { data, error } = await supabase.storage
    .from(BUCKET_LOGO)
    .createSignedUrl(path, 60 * 60); // 1h

  if (error) return null;
  return data.signedUrl;
}
