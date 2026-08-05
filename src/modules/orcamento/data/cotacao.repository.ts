import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export interface ItemCotacao {
  id: string;
  descricao: string;
  quantidade: number;
  fornecedorId: string | null;
  custoCotado: number | null;
  precoUnitario: number;
  orcamentoId: string;
  orcamentoNumero: number;
  queixa: string | null;
  veiculo: { placa: string; modelo: string; marca: string | null; ano: number | null } | null;
}

// Itens de peça de todos os orçamentos em rascunho — a fila de cotação. Traz
// junto o veículo e a queixa (do orçamento) para agrupar por carro na tela.
export async function listarItensParaCotar(supabase: Client): Promise<ItemCotacao[]> {
  type Row = {
    id: string;
    descricao: string;
    quantidade: number;
    fornecedor_id: string | null;
    custo_cotado: number | null;
    preco_unitario: number;
    orcamento: {
      id: string;
      numero: number;
      queixa: string | null;
      status: string;
      deleted_at: string | null;
      veiculo: { placa: string; modelo: string; marca: string | null; ano: number | null } | null;
    } | null;
  };

  const { data, error } = await supabase
    .from("orcamento_item")
    .select(
      "id, descricao, quantidade, fornecedor_id, custo_cotado, preco_unitario, " +
        "orcamento!inner(id, numero, queixa, status, deleted_at, veiculo(placa, modelo, marca, ano))"
    )
    .eq("tipo", "peca")
    .eq("orcamento.status", "rascunho")
    .is("orcamento.deleted_at", null)
    .order("orcamento_id")
    .order("created_at")
    .overrideTypes<Row[], { merge: false }>();

  if (error) throw error;

  return data.map((r) => ({
    id: r.id,
    descricao: r.descricao,
    quantidade: r.quantidade,
    fornecedorId: r.fornecedor_id,
    custoCotado: r.custo_cotado,
    precoUnitario: r.preco_unitario,
    orcamentoId: r.orcamento?.id ?? "",
    orcamentoNumero: r.orcamento?.numero ?? 0,
    queixa: r.orcamento?.queixa ?? null,
    veiculo: r.orcamento?.veiculo ?? null,
  }));
}

// Itens de peça já cotados (com custo) de um orçamento — usado para reaplicar
// o markup em todos de uma vez na tela de detalhe.
export async function listarItensCotadosDoOrcamento(
  supabase: Client,
  orcamentoId: string
): Promise<{ id: string; fornecedorId: string | null; custoCotado: number }[]> {
  const { data, error } = await supabase
    .from("orcamento_item")
    .select("id, fornecedor_id, custo_cotado")
    .eq("orcamento_id", orcamentoId)
    .eq("tipo", "peca")
    .not("custo_cotado", "is", null);

  if (error) throw error;

  return (data ?? []).map((r) => ({
    id: r.id,
    fornecedorId: r.fornecedor_id,
    custoCotado: r.custo_cotado as number,
  }));
}

// Grava uma leva de cotações. preco_unitario já vem calculado da aplicação
// (aplicarMarkup) — ver salvarCotacoesAction.
export async function salvarCotacoes(
  supabase: Client,
  itens: {
    id: string;
    fornecedorId: string | null;
    custoCotado: number | null;
    precoUnitario: number | null;
  }[]
) {
  const { error } = await supabase.rpc("salvar_cotacoes", {
    p_itens: itens.map((i) => ({
      id: i.id,
      fornecedor_id: i.fornecedorId,
      custo_cotado: i.custoCotado,
      preco_unitario: i.precoUnitario,
    })),
  });
  if (error) throw error;
}
