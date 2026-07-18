import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { PagamentoInput } from "@/lib/validators/financeiro.schema";

type Client = SupabaseClient<Database>;

export async function buscarParcelaPorId(supabase: Client, parcelaId: string) {
  const { data, error } = await supabase
    .from("parcela_financeira")
    .select("*")
    .eq("id", parcelaId)
    .single();

  if (error) throw error;
  return data;
}

export async function registrarPagamento(
  supabase: Client,
  parcelaId: string,
  usuarioId: string,
  dados: PagamentoInput
) {
  const { data, error } = await supabase.rpc("registrar_pagamento", {
    p_parcela_id: parcelaId,
    p_valor: dados.valor,
    p_desconto: dados.desconto ?? 0,
    p_data_pagamento: dados.dataPagamento,
    p_forma_pagamento: dados.formaPagamento,
    p_observacoes: dados.observacoes || null,
    p_created_by: usuarioId,
  });

  if (error) throw error;
  return data as string;
}

export async function estornarPagamento(
  supabase: Client,
  pagamentoId: string,
  usuarioId: string
) {
  const { error } = await supabase.rpc("estornar_pagamento", {
    p_pagamento_id: pagamentoId,
    p_estornado_por: usuarioId,
  });

  if (error) throw error;
}
