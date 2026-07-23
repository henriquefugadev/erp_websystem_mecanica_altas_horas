import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { PedidoCompraInput, RecebimentoInput } from "@/lib/validators/pedido-compra.schema";
import type { PedidoComRelacoes } from "@/modules/fornecedores/domain/types";

type Client = SupabaseClient<Database>;

// A combinação de embed direto (ordem_servico) com dois embeds reversos
// (pedido_compra_item, recebimento_compra) estoura a inferência de tipos do
// postgrest-js, que cai em GenericStringError. overrideTypes contorna isso
// sem afetar o que roda de verdade contra o banco (mesmo shape de
// PedidoComRelacoes usado no domínio).
const SELECT_DETALHE =
  "*, fornecedor(nome), categoria_financeira(nome), ordem_servico(numero, queixa), " +
  "pedido_compra_item(*), recebimento_compra(*, conta_financeira(status))";

export async function listarPedidos(supabase: Client, fornecedorId?: string) {
  let query = supabase
    .from("pedido_compra")
    .select("*, fornecedor(nome), categoria_financeira(nome)")
    .is("deleted_at", null)
    .order("numero", { ascending: false });

  if (fornecedorId) query = query.eq("fornecedor_id", fornecedorId);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function buscarPedidoPorId(supabase: Client, id: string) {
  const { data, error } = await supabase
    .from("pedido_compra")
    .select(SELECT_DETALHE)
    .eq("id", id)
    .is("deleted_at", null)
    .single()
    .overrideTypes<PedidoComRelacoes, { merge: false }>();

  if (error) throw error;
  return data;
}

export async function criarPedido(
  supabase: Client,
  workshopId: string,
  usuarioId: string,
  dados: PedidoCompraInput
) {
  const { data, error } = await supabase.rpc("criar_pedido_compra", {
    p_workshop_id: workshopId,
    p_fornecedor_id: dados.fornecedorId,
    p_categoria_id: dados.categoriaId,
    p_data_emissao: dados.dataEmissao,
    p_previsao_entrega: dados.previsaoEntrega || null,
    p_observacoes: dados.observacoes || null,
    p_ordem_servico_id: dados.ordemServicoId || null,
    p_created_by: usuarioId,
    p_itens: dados.itens.map((item) => ({
      descricao: item.descricao,
      quantidade: item.quantidade,
      preco_unitario: item.precoUnitario,
    })),
  });

  if (error) throw error;
  return data as string;
}

export async function receberPedido(
  supabase: Client,
  pedidoId: string,
  usuarioId: string,
  dados: RecebimentoInput
) {
  const { data, error } = await supabase.rpc("receber_pedido_compra", {
    p_pedido_id: pedidoId,
    p_itens: dados.itens.map((item) => ({
      pedido_item_id: item.pedidoItemId,
      quantidade: item.quantidade,
    })),
    p_data_recebimento: dados.dataRecebimento,
    p_vencimento: dados.vencimento,
    p_observacoes: dados.observacoes || null,
    p_created_by: usuarioId,
  });

  if (error) throw error;
  return data as string;
}

export async function cancelarPedido(supabase: Client, id: string) {
  const { error } = await supabase
    .from("pedido_compra")
    .update({ status: "cancelado" })
    .eq("id", id);

  if (error) throw error;
}
