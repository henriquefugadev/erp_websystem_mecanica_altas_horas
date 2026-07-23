import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { FornecedorInput } from "@/lib/validators/fornecedor.schema";

type Client = SupabaseClient<Database>;

export async function listarFornecedores(supabase: Client, apenasAtivos = false) {
  let query = supabase.from("fornecedor").select("*").is("deleted_at", null).order("nome");
  if (apenasAtivos) query = query.eq("ativo", true);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function buscarFornecedorPorId(supabase: Client, id: string) {
  const { data, error } = await supabase
    .from("fornecedor")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error) throw error;
  return data;
}

export async function criarFornecedor(
  supabase: Client,
  workshopId: string,
  usuarioId: string,
  dados: FornecedorInput
) {
  const { data, error } = await supabase
    .from("fornecedor")
    .insert({
      workshop_id: workshopId,
      created_by: usuarioId,
      nome: dados.nome,
      documento: dados.documento || null,
      telefone: dados.telefone || null,
      email: dados.email || null,
      contato_nome: dados.contatoNome || null,
      condicoes_pagamento: dados.condicoesPagamento || null,
      prazo_entrega_dias: dados.prazoEntregaDias ?? null,
      observacoes: dados.observacoes || null,
      ativo: dados.ativo,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function atualizarFornecedor(supabase: Client, id: string, dados: FornecedorInput) {
  const { data, error } = await supabase
    .from("fornecedor")
    .update({
      nome: dados.nome,
      documento: dados.documento || null,
      telefone: dados.telefone || null,
      email: dados.email || null,
      contato_nome: dados.contatoNome || null,
      condicoes_pagamento: dados.condicoesPagamento || null,
      prazo_entrega_dias: dados.prazoEntregaDias ?? null,
      observacoes: dados.observacoes || null,
      ativo: dados.ativo,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function softDeleteFornecedor(supabase: Client, id: string) {
  const { error } = await supabase
    .from("fornecedor")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}
