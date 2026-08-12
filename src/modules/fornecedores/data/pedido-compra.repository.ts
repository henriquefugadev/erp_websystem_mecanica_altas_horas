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

// `limite` recorta a listagem — ver lib/paginacao.ts.
export async function listarPedidos(
  supabase: Client,
  fornecedorId?: string,
  limite?: number
) {
  let query = supabase
    .from("pedido_compra")
    .select("*, fornecedor(nome), categoria_financeira(nome)")
    .is("deleted_at", null)
    .order("numero", { ascending: false });

  if (fornecedorId) query = query.eq("fornecedor_id", fornecedorId);
  if (limite) query = query.limit(limite);

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

// Status atual da OS vinculada — usado no recebimento para avisar quando a OS
// que esperava peça foi liberada.
export async function buscarStatusOrdem(
  supabase: Client,
  ordemId: string
): Promise<{ numero: number; status: string; motivoParada: string | null } | null> {
  const { data, error } = await supabase
    .from("ordem_servico")
    .select("numero, status, motivo_parada")
    .eq("id", ordemId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return { numero: data.numero, status: data.status, motivoParada: data.motivo_parada };
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

// ============ Gerar pedidos a partir do orçamento aprovado (Fase 6) ============

export interface GrupoPedido {
  fornecedorId: string;
  fornecedorNome: string;
  itens: number;
  total: number;
}

export interface ResumoPedidos {
  grupos: GrupoPedido[];
  itensSemFornecedor: number;
  jaGerado: boolean;
}

// Prévia do que "Gerar pedidos" vai criar: um grupo por fornecedor (com total
// pelo custo cotado), quantos itens ficam de fora (sem fornecedor ou sem custo)
// e se os pedidos já foram gerados antes (evita duplicar).
export async function resumoPedidosDoOrcamento(
  supabase: Client,
  orcamentoId: string
): Promise<ResumoPedidos> {
  type Row = {
    id: string;
    quantidade: number;
    custo_cotado: number | null;
    fornecedor_id: string | null;
    fornecedor: { nome: string } | null;
  };

  const { data, error } = await supabase
    .from("orcamento_item")
    .select("id, quantidade, custo_cotado, fornecedor_id, fornecedor(nome)")
    .eq("orcamento_id", orcamentoId)
    .eq("tipo", "peca")
    .eq("aprovado", true)
    .overrideTypes<Row[], { merge: false }>();

  if (error) throw error;

  const grupos = new Map<string, GrupoPedido>();
  let itensSemFornecedor = 0;
  for (const item of data) {
    if (item.fornecedor_id === null || item.custo_cotado === null) {
      itensSemFornecedor += 1;
      continue;
    }
    const grupo = grupos.get(item.fornecedor_id) ?? {
      fornecedorId: item.fornecedor_id,
      fornecedorNome: item.fornecedor?.nome ?? "—",
      itens: 0,
      total: 0,
    };
    grupo.itens += 1;
    grupo.total += item.custo_cotado * item.quantidade;
    grupos.set(item.fornecedor_id, grupo);
  }

  let jaGerado = false;
  const ids = data.map((i) => i.id);
  if (ids.length > 0) {
    const { data: pedItens, error: erroPed } = await supabase
      .from("pedido_compra_item")
      .select("id")
      .in("orcamento_item_id", ids)
      .limit(1);
    if (erroPed) throw erroPed;
    jaGerado = (pedItens?.length ?? 0) > 0;
  }

  return { grupos: [...grupos.values()], itensSemFornecedor, jaGerado };
}

export async function gerarPedidosDoOrcamento(
  supabase: Client,
  orcamentoId: string,
  categoriaId: string,
  usuarioId: string
): Promise<string[]> {
  const { data, error } = await supabase.rpc("gerar_pedidos_do_orcamento", {
    p_orcamento_id: orcamentoId,
    p_categoria_id: categoriaId,
    p_created_by: usuarioId,
  });
  if (error) throw error;
  return (data ?? []) as string[];
}
