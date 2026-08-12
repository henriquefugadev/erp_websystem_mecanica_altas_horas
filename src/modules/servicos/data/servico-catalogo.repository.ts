import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { ServicoCatalogoInput } from "@/lib/validators/servico-catalogo.schema";

type Client = SupabaseClient<Database>;

export interface ServicoCatalogo {
  id: string;
  nome: string;
  preco_padrao: number;
  duracao_minutos: number | null;
  ativo: boolean;
  ordem: number;
}

const SELECT = "id, nome, preco_padrao, duracao_minutos, ativo, ordem";

/**
 * Serviços do catálogo da oficina.
 *
 * Erro de leitura devolve lista vazia em vez de derrubar a tela: o catálogo é
 * uma conveniência (autocomplete), não um dado crítico — e assim o pátio
 * continua funcionando entre publicar o código e rodar a migração 0023.
 */
export async function listarServicosCatalogo(
  supabase: Client,
  apenasAtivos = false
): Promise<ServicoCatalogo[]> {
  let query = supabase
    .from("servico_catalogo")
    .select(SELECT)
    .order("ordem", { ascending: true })
    .order("nome", { ascending: true });

  if (apenasAtivos) query = query.eq("ativo", true);

  const { data, error } = await query;
  if (error) {
    console.warn(
      "[servico_catalogo] leitura falhou (a migração 0023 já rodou?):",
      error.message
    );
    return [];
  }
  return data ?? [];
}

export async function criarServicoCatalogo(
  supabase: Client,
  workshopId: string,
  dados: ServicoCatalogoInput
) {
  // Serviço novo entra no fim da lista.
  const { data: ultimo } = await supabase
    .from("servico_catalogo")
    .select("ordem")
    .eq("workshop_id", workshopId)
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("servico_catalogo").insert({
    workshop_id: workshopId,
    nome: dados.nome,
    preco_padrao: dados.precoPadrao,
    duracao_minutos: dados.duracaoMinutos,
    ativo: dados.ativo,
    ordem: (ultimo?.ordem ?? -1) + 1,
  });
  if (error) throw error;
}

export async function atualizarServicoCatalogo(
  supabase: Client,
  id: string,
  dados: ServicoCatalogoInput
) {
  const { error } = await supabase
    .from("servico_catalogo")
    .update({
      nome: dados.nome,
      preco_padrao: dados.precoPadrao,
      duracao_minutos: dados.duracaoMinutos,
      ativo: dados.ativo,
    })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Exclui de vez. Diferente de `tipo_item_orcamento`, o catálogo não rotula
 * histórico nenhum — o orçamento copia a descrição e o preço para os próprios
 * itens no momento em que a linha é criada. Apagar aqui não mexe em orçamento
 * antigo, então não precisa do "desativa em vez de excluir".
 */
export async function excluirServicoCatalogo(supabase: Client, id: string) {
  const { error } = await supabase.from("servico_catalogo").delete().eq("id", id);
  if (error) throw error;
}
