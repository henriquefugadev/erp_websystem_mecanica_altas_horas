import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { PecaInput } from "@/lib/validators/peca.schema";

type Client = SupabaseClient<Database>;

export async function listarPecas(supabase: Client, apenasAtivas = false) {
  let query = supabase.from("peca").select("*").is("deleted_at", null).order("nome");
  if (apenasAtivas) query = query.eq("ativo", true);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function buscarPecaPorId(supabase: Client, id: string) {
  const { data, error } = await supabase
    .from("peca")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error) throw error;
  return data;
}

export async function criarPeca(
  supabase: Client,
  workshopId: string,
  usuarioId: string,
  dados: PecaInput
) {
  const { data, error } = await supabase
    .from("peca")
    .insert({
      workshop_id: workshopId,
      created_by: usuarioId,
      sku: dados.sku || null,
      nome: dados.nome,
      fabricante: dados.fabricante || null,
      aplicacao: dados.aplicacao || null,
      unidade: dados.unidade,
      localizacao: dados.localizacao || null,
      preco_venda: dados.precoVenda,
      estoque_minimo: dados.estoqueMinimo,
      observacoes: dados.observacoes || null,
      ativo: dados.ativo,
    })
    .select()
    .single();

  if (error) throw error;

  // Estoque de abertura: uma entrada como qualquer outra, nunca grava
  // estoque_atual/custo_medio direto — mesma regra do resto do módulo.
  if (dados.quantidadeInicial && dados.quantidadeInicial > 0) {
    const { error: erroMovimentacao } = await supabase.from("movimentacao_estoque").insert({
      workshop_id: workshopId,
      peca_id: data.id,
      tipo: "entrada",
      quantidade: dados.quantidadeInicial,
      custo_unitario: dados.custoInicial ?? null,
      observacao: "Estoque de abertura",
      created_by: usuarioId,
    });
    if (erroMovimentacao) throw erroMovimentacao;
  }

  return data;
}

export async function atualizarPeca(supabase: Client, id: string, dados: PecaInput) {
  const { data, error } = await supabase
    .from("peca")
    .update({
      sku: dados.sku || null,
      nome: dados.nome,
      fabricante: dados.fabricante || null,
      aplicacao: dados.aplicacao || null,
      unidade: dados.unidade,
      localizacao: dados.localizacao || null,
      preco_venda: dados.precoVenda,
      estoque_minimo: dados.estoqueMinimo,
      observacoes: dados.observacoes || null,
      ativo: dados.ativo,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function softDeletePeca(supabase: Client, id: string) {
  const { error } = await supabase
    .from("peca")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}
