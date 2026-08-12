import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { WorkshopInput } from "@/lib/validators/workshop.schema";
import {
  parametrosPatio,
  type FonteParametros,
  type ParametrosPatio,
} from "../domain/parametros";

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

// Só as colunas de parametrização — o pátio precisa delas em toda abertura e
// não tem por que arrastar endereço, CNPJ, logo e PIX junto.
const COLUNAS_PARAMETROS =
  "galpoes_quantidade, galpao_capacidade, galpao_nomes, sla_aguardando_horas, " +
  "sla_confirmacao_horas, sla_execucao_horas, sla_parado_horas, " +
  "garantia_meses_padrao, dias_os_concluida_quadro, categoria_peca_id, categoria_mao_obra_id";

/**
 * Parâmetros operacionais da oficina, já com os padrões aplicados.
 *
 * Falha de leitura NÃO derruba a tela: cai nos padrões históricos, que são
 * exatamente o comportamento anterior à parametrização. Isso cobre o intervalo
 * entre publicar o código e rodar a migração 0023 no Supabase — sem isso, o
 * pátio inteiro quebraria com "column does not exist" até a migração rodar.
 */
export async function buscarParametros(
  supabase: Client,
  workshopId: string
): Promise<ParametrosPatio> {
  const { data, error } = await supabase
    .from("workshop")
    .select(COLUNAS_PARAMETROS)
    .eq("id", workshopId)
    .maybeSingle()
    // A lista de colunas é uma constante montada em runtime, então o
    // supabase-js não consegue inferir a forma da linha sozinho.
    .overrideTypes<FonteParametros | null, { merge: false }>();

  if (error) {
    console.warn(
      "[workshop] não foi possível ler os parâmetros (a migração 0023 já rodou?):",
      error.message
    );
    return parametrosPatio(null);
  }
  return parametrosPatio(data);
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
      chave_pix: dados.chavePix || null,
      pix_favorecido: dados.pixFavorecido || null,
      validade_orcamento_dias: dados.validadeOrcamentoDias,
      markup_peca_percentual: dados.markupPecaPercentual,
      valor_hora_mao_obra: dados.valorHoraMaoObra,
      markup_habilitado: dados.markupHabilitado,
      nav_ocultos: dados.navOcultos,
      galpoes_quantidade: dados.galpoesQuantidade,
      galpao_capacidade: dados.galpaoCapacidade,
      galpao_nomes: dados.galpaoNomes,
      sla_aguardando_horas: dados.slaAguardandoHoras,
      sla_confirmacao_horas: dados.slaConfirmacaoHoras,
      sla_execucao_horas: dados.slaExecucaoHoras,
      sla_parado_horas: dados.slaParadoHoras,
      garantia_meses_padrao: dados.garantiaMesesPadrao,
      dias_os_concluida_quadro: dados.diasOsConcluidaQuadro,
      categoria_peca_id: dados.categoriaPecaId || null,
      categoria_mao_obra_id: dados.categoriaMaoObraId || null,
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
