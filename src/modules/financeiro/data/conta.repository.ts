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
  /** Recorta a listagem — ver lib/paginacao.ts. Sem valor, devolve tudo. */
  limite?: number;
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
  if (filtros.limite) query = query.limit(filtros.limite);

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
    .eq("id", id)
    // `.select().single()` de propósito: um UPDATE barrado pela RLS afeta 0
    // linhas e NÃO devolve erro — a tela diria "cancelada" sem nada ter mudado.
    // Com o single(), 0 linhas viram PGRST116 e o erro sobe até o usuário.
    .select("id")
    .single();

  if (error) throw error;
}

// Exclui a conta (soft-delete): a RLS não libera DELETE físico para a aplicação,
// então marcamos `deleted_at` — some da lista, do detalhe e da inadimplência
// (todos filtram deleted_at), mas continua no banco para auditoria. Antes,
// cancelamos as parcelas em aberto: o `financeiro_resumo` do dashboard NÃO
// filtra deleted_at, então sem isso o saldo de uma conta de teste seguiria
// contando em "a receber"/"a pagar". Uso principal: limpar lançamentos de teste.
export async function excluirConta(supabase: Client, id: string) {
  const { error: erroParcelas } = await supabase
    .from("parcela_financeira")
    .update({ status: "cancelada" })
    .eq("conta_id", id)
    .in("status", ["aberta", "parcial"]);

  if (erroParcelas) throw erroParcelas;

  const { error } = await supabase
    .from("conta_financeira")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    // Ver o comentário em cancelarConta: sem o single(), a RLS bloqueando vira
    // um "excluída" mentiroso na tela.
    .select("id")
    .single();

  if (error) throw error;
}
