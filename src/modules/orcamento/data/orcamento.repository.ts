import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { OrcamentoOutput } from "@/lib/validators/orcamento.schema";
import type { OrcamentoComCliente, OrcamentoComRelacoes } from "../domain/types";

type Client = SupabaseClient<Database>;

const SELECT_LISTA = "*, cliente(nome), veiculo(placa, modelo, marca)";

const SELECT_DETALHE =
  "*, cliente(nome, telefone), veiculo(placa, modelo, marca, ano), " +
  "orcamento_item(*), ordem_servico(numero)";

export async function listarOrcamentos(supabase: Client) {
  const { data, error } = await supabase
    .from("vw_orcamento")
    .select(SELECT_LISTA)
    .order("numero", { ascending: false })
    .overrideTypes<OrcamentoComCliente[], { merge: false }>();

  if (error) throw error;
  return data;
}

export async function buscarOrcamentoPorId(supabase: Client, id: string) {
  const { data, error } = await supabase
    .from("vw_orcamento")
    .select(SELECT_DETALHE)
    .eq("id", id)
    .single()
    .overrideTypes<OrcamentoComRelacoes, { merge: false }>();

  if (error) throw error;
  return data;
}

export async function criarOrcamento(
  supabase: Client,
  workshopId: string,
  usuarioId: string,
  dados: OrcamentoOutput
) {
  const { data, error } = await supabase.rpc("criar_orcamento", {
    p_workshop_id: workshopId,
    p_cliente_id: dados.clienteId,
    p_veiculo_id: dados.veiculoId,
    p_queixa: dados.queixa,
    p_observacoes: dados.observacoes || null,
    p_condicoes_pagamento: dados.condicoesPagamento || null,
    p_validade: dados.validade,
    p_itens: dados.itens.map((item) => ({
      tipo: item.tipo,
      descricao: item.descricao,
      quantidade: item.quantidade,
      preco_unitario: item.precoUnitario,
      desconto: item.desconto,
    })),
    p_created_by: usuarioId,
  });

  if (error) throw error;
  return data as string;
}

export async function marcarOrcamentoEnviado(supabase: Client, id: string) {
  const { error } = await supabase
    .from("orcamento")
    .update({ status: "enviado", enviado_em: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

export async function recusarOrcamento(supabase: Client, id: string) {
  const { error } = await supabase
    .from("orcamento")
    .update({ status: "recusado", respondido_em: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

export async function cancelarOrcamento(supabase: Client, id: string) {
  const { error } = await supabase.from("orcamento").update({ status: "cancelado" }).eq("id", id);
  if (error) throw error;
}

// Retorna o id da nova ordem de serviço gerada.
export async function aprovarOrcamento(
  supabase: Client,
  orcamentoId: string,
  itensAprovadosIds: string[],
  usuarioId: string
) {
  const { data, error } = await supabase.rpc("aprovar_orcamento", {
    p_orcamento_id: orcamentoId,
    p_itens_aprovados: itensAprovadosIds,
    p_created_by: usuarioId,
  });

  if (error) throw error;
  return data as string;
}
