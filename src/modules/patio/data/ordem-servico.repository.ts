import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { OrdemServicoInput } from "@/lib/validators/ordem-servico.schema";
import type { Galpao } from "../domain/types";

type Client = SupabaseClient<Database>;

const SELECT_QUADRO =
  "*, cliente(nome), veiculo(placa, modelo, marca), conta_financeira(status), funcionario(nome)";

export async function listarOrdensDoQuadro(supabase: Client) {
  // O quadro é operacional, não um histórico: OS concluídas somem depois de
  // 7 dias (continuam no banco/relatórios, só saem da visão do dia a dia).
  const seteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("ordem_servico")
    .select(SELECT_QUADRO)
    .is("deleted_at", null)
    .neq("status", "cancelada")
    .or(`status.neq.concluido,data_conclusao.gte.${seteDiasAtras}`)
    .order("numero", { ascending: true });

  if (error) throw error;
  return data;
}

export async function buscarOrdemPorId(supabase: Client, id: string) {
  const { data, error } = await supabase
    .from("ordem_servico")
    .select("id, status, galpao, workshop_id, cliente_id")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function criarOrdem(
  supabase: Client,
  workshopId: string,
  usuarioId: string,
  dados: OrdemServicoInput
) {
  const { data, error } = await supabase
    .from("ordem_servico")
    .insert({
      workshop_id: workshopId,
      created_by: usuarioId,
      cliente_id: dados.clienteId,
      veiculo_id: dados.veiculoId,
      queixa: dados.queixa,
      descricao: dados.descricao || null,
      funcionario_id: dados.funcionarioId || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function iniciarOrdem(supabase: Client, id: string, galpao: Galpao) {
  const { error } = await supabase
    .from("ordem_servico")
    .update({ status: "em_execucao", data_inicio: new Date().toISOString(), galpao })
    .eq("id", id);

  if (error) throw error;
}

// Desfaz o início por engano: volta como se não tivesse começado — libera o
// galpão e limpa data_inicio, pra próxima vez que iniciar carimbar de novo.
export async function voltarParaAguardando(supabase: Client, id: string) {
  const { error } = await supabase
    .from("ordem_servico")
    .update({ status: "aguardando", galpao: null, data_inicio: null })
    .eq("id", id);

  if (error) throw error;
}

export async function pausarOrdem(supabase: Client, id: string) {
  const { error } = await supabase
    .from("ordem_servico")
    .update({ status: "parado", data_pausa: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

export async function retomarOrdem(supabase: Client, id: string) {
  const { error } = await supabase
    .from("ordem_servico")
    .update({ status: "em_execucao", data_pausa: null })
    .eq("id", id);

  if (error) throw error;
}

export async function moverGalpao(supabase: Client, id: string, galpao: Galpao) {
  const { error } = await supabase.from("ordem_servico").update({ galpao }).eq("id", id);
  if (error) throw error;
}

export async function cancelarOrdem(supabase: Client, id: string) {
  const { error } = await supabase
    .from("ordem_servico")
    .update({ status: "cancelada" })
    .eq("id", id);

  if (error) throw error;
}

export async function concluirOrdem(
  supabase: Client,
  id: string,
  usuarioId: string,
  dados: {
    vencimento: string | null;
    itens: { categoriaId: string; valor: number }[];
  }
) {
  const { data, error } = await supabase.rpc("concluir_ordem_servico", {
    p_ordem_id: id,
    p_itens: dados.itens.map((item) => ({ categoria_id: item.categoriaId, valor: item.valor })),
    p_vencimento: dados.vencimento,
    p_created_by: usuarioId,
  });

  if (error) throw error;
  return data;
}
