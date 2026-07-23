import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { MovimentacaoInput } from "@/lib/validators/peca.schema";
import { sinalPorTipo } from "../domain/estoque";

type Client = SupabaseClient<Database>;

export async function listarMovimentacoesDaPeca(supabase: Client, pecaId: string) {
  const { data, error } = await supabase
    .from("movimentacao_estoque")
    .select("*, ordem_servico(numero)")
    .eq("peca_id", pecaId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

// entrada/devolucao/perda: insert direto no ledger (assinado). saida_consumo
// só existe via RPC consumir_peca_os (patio); ajuste via RPC ajustar_estoque.
// O CHECK movimentacao_estoque_sinal_por_tipo é quem garante, no banco, que
// o sinal aplicado aqui bate com o tipo — mesma regra de sinalPorTipo.
export async function registrarMovimentacao(
  supabase: Client,
  workshopId: string,
  usuarioId: string,
  dados: MovimentacaoInput
) {
  const { data, error } = await supabase
    .from("movimentacao_estoque")
    .insert({
      workshop_id: workshopId,
      peca_id: dados.pecaId,
      tipo: dados.tipo,
      quantidade: sinalPorTipo(dados.tipo) * dados.quantidade,
      custo_unitario: dados.tipo === "entrada" ? (dados.custoUnitario ?? null) : null,
      observacao: dados.observacao || null,
      created_by: usuarioId,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function ajustarEstoque(
  supabase: Client,
  usuarioId: string,
  pecaId: string,
  quantidadeContada: number,
  observacao: string | null
) {
  const { data, error } = await supabase.rpc("ajustar_estoque", {
    p_peca_id: pecaId,
    p_quantidade_contada: quantidadeContada,
    p_observacao: observacao,
    p_created_by: usuarioId,
  });

  if (error) throw error;
  return data;
}

export async function consumirPecaOs(
  supabase: Client,
  usuarioId: string,
  ordemId: string,
  pecaId: string,
  quantidade: number
) {
  const { data, error } = await supabase.rpc("consumir_peca_os", {
    p_ordem_id: ordemId,
    p_peca_id: pecaId,
    p_quantidade: quantidade,
    p_created_by: usuarioId,
  });

  if (error) throw error;
  return data;
}
