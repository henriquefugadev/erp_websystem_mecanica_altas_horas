import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { FuncionarioInput } from "@/lib/validators/funcionario.schema";

type Client = SupabaseClient<Database>;

export async function listarFuncionarios(supabase: Client, apenasAtivos = false) {
  let query = supabase.from("funcionario").select("*").is("deleted_at", null).order("nome");
  if (apenasAtivos) query = query.eq("ativo", true);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function buscarFuncionarioPorId(supabase: Client, id: string) {
  const { data, error } = await supabase
    .from("funcionario")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error) throw error;
  return data;
}

export async function criarFuncionario(
  supabase: Client,
  workshopId: string,
  usuarioId: string,
  dados: FuncionarioInput
) {
  const { data, error } = await supabase
    .from("funcionario")
    .insert({
      workshop_id: workshopId,
      created_by: usuarioId,
      nome: dados.nome,
      funcao: dados.funcao || null,
      telefone: dados.telefone || null,
      email: dados.email || null,
      observacoes: dados.observacoes || null,
      ativo: dados.ativo,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function atualizarFuncionario(supabase: Client, id: string, dados: FuncionarioInput) {
  const { data, error } = await supabase
    .from("funcionario")
    .update({
      nome: dados.nome,
      funcao: dados.funcao || null,
      telefone: dados.telefone || null,
      email: dados.email || null,
      observacoes: dados.observacoes || null,
      ativo: dados.ativo,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function softDeleteFuncionario(supabase: Client, id: string) {
  const { error } = await supabase
    .from("funcionario")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}
