import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, NaturezaItemOrcamento } from "@/lib/supabase/database.types";
import type { TipoItemInput } from "@/lib/validators/tipo-item.schema";

type Client = SupabaseClient<Database>;

export interface TipoItemOrcamento {
  id: string;
  nome: string;
  natureza: NaturezaItemOrcamento;
  ativo: boolean;
  ordem: number;
}

const SELECT = "id, nome, natureza, ativo, ordem";

export async function listarTiposItemOrcamento(
  supabase: Client,
  apenasAtivos = false
): Promise<TipoItemOrcamento[]> {
  let query = supabase
    .from("tipo_item_orcamento")
    .select(SELECT)
    .order("ordem", { ascending: true })
    .order("nome", { ascending: true });

  if (apenasAtivos) query = query.eq("ativo", true);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function criarTipoItem(
  supabase: Client,
  workshopId: string,
  dados: TipoItemInput
) {
  // Nova opção entra no fim da lista.
  const { data: ultimo } = await supabase
    .from("tipo_item_orcamento")
    .select("ordem")
    .eq("workshop_id", workshopId)
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("tipo_item_orcamento").insert({
    workshop_id: workshopId,
    nome: dados.nome,
    natureza: dados.natureza,
    ativo: dados.ativo,
    ordem: (ultimo?.ordem ?? -1) + 1,
  });
  if (error) throw error;
}

export async function atualizarTipoItem(
  supabase: Client,
  id: string,
  dados: TipoItemInput
) {
  const { error } = await supabase
    .from("tipo_item_orcamento")
    .update({ nome: dados.nome, natureza: dados.natureza, ativo: dados.ativo })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Exclui o tipo. Se ele já rotulou algum item de orçamento (histórico),
 * apenas desativa — para não deixar itens antigos apontando para um rótulo
 * inexistente. Caso contrário, remove de vez.
 */
export async function excluirTipoItem(supabase: Client, id: string) {
  const { data: tipo, error: erroBusca } = await supabase
    .from("tipo_item_orcamento")
    .select("nome")
    .eq("id", id)
    .single();
  if (erroBusca) throw erroBusca;

  const { count, error: erroUso } = await supabase
    .from("orcamento_item")
    .select("id", { count: "exact", head: true })
    .eq("tipo_nome", tipo.nome);
  if (erroUso) throw erroUso;

  if ((count ?? 0) > 0) {
    const { error } = await supabase
      .from("tipo_item_orcamento")
      .update({ ativo: false })
      .eq("id", id);
    if (error) throw error;
    return { desativado: true as const };
  }

  const { error } = await supabase.from("tipo_item_orcamento").delete().eq("id", id);
  if (error) throw error;
  return { desativado: false as const };
}
