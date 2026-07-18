import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  StatusFinanceiro,
  TipoContaFinanceira,
} from "@/lib/supabase/database.types";
import type { ContaInput } from "@/lib/validators/financeiro.schema";

type Client = SupabaseClient<Database>;

export interface FiltrosConta {
  tipo?: TipoContaFinanceira;
  status?: StatusFinanceiro;
  de?: string;
  ate?: string;
  busca?: string;
}

export async function listarContas(supabase: Client, filtros: FiltrosConta = {}) {
  let query = supabase
    .from("conta_financeira")
    .select("*, categoria_financeira(nome), cliente(nome)")
    .is("deleted_at", null)
    .order("data_emissao", { ascending: false });

  if (filtros.tipo) query = query.eq("tipo", filtros.tipo);
  if (filtros.status) query = query.eq("status", filtros.status);
  if (filtros.de) query = query.gte("data_emissao", filtros.de);
  if (filtros.ate) query = query.lte("data_emissao", filtros.ate);
  if (filtros.busca && filtros.busca.trim() !== "") {
    query = query.ilike("descricao", `%${filtros.busca.trim()}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function buscarContaPorId(supabase: Client, id: string) {
  const { data, error } = await supabase
    .from("conta_financeira")
    .select(
      "*, categoria_financeira(*), cliente(nome), parcela_financeira(*, pagamento_financeira(*))"
    )
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error) throw error;
  return data;
}

export async function criarConta(
  supabase: Client,
  workshopId: string,
  usuarioId: string,
  dados: ContaInput
) {
  const { data, error } = await supabase.rpc("criar_conta_financeira", {
    p_workshop_id: workshopId,
    p_tipo: dados.tipo,
    p_descricao: dados.descricao,
    p_categoria_id: dados.categoriaId,
    p_valor_total: dados.valorTotal,
    p_data_emissao: dados.dataEmissao,
    p_cliente_id: dados.clienteId || null,
    p_fornecedor_nome: dados.fornecedorNome || null,
    p_observacoes: dados.observacoes || null,
    p_created_by: usuarioId,
    p_parcelas: dados.parcelas.map((p) => ({
      numero: p.numero,
      valor: p.valor,
      vencimento: p.vencimento,
    })),
  });

  if (error) throw error;
  return data as string;
}

export async function cancelarConta(supabase: Client, id: string) {
  const { error: erroParcelas } = await supabase
    .from("parcela_financeira")
    .update({ status: "cancelada" })
    .eq("conta_id", id)
    .in("status", ["aberta", "parcial"]);

  if (erroParcelas) throw erroParcelas;

  const { error } = await supabase
    .from("conta_financeira")
    .update({ status: "cancelada" })
    .eq("id", id);

  if (error) throw error;
}
