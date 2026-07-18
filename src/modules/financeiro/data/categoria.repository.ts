import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TipoCategoriaFinanceira } from "@/lib/supabase/database.types";
import type { CategoriaInput } from "@/lib/validators/financeiro.schema";

type Client = SupabaseClient<Database>;

export async function listarCategorias(supabase: Client, tipo?: TipoCategoriaFinanceira) {
  let query = supabase
    .from("categoria_financeira")
    .select("*")
    .is("deleted_at", null)
    .order("nome");

  if (tipo) query = query.eq("tipo", tipo);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function criarCategoria(
  supabase: Client,
  workshopId: string,
  dados: CategoriaInput
) {
  const { data, error } = await supabase
    .from("categoria_financeira")
    .insert({ workshop_id: workshopId, tipo: dados.tipo, nome: dados.nome })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function atualizarCategoria(
  supabase: Client,
  id: string,
  dados: CategoriaInput
) {
  const { data, error } = await supabase
    .from("categoria_financeira")
    .update({ tipo: dados.tipo, nome: dados.nome })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function softDeleteCategoria(supabase: Client, id: string) {
  const { error } = await supabase
    .from("categoria_financeira")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}
