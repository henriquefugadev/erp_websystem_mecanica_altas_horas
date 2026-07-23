import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { ClienteInput } from "@/lib/validators/cliente.schema";

type Client = SupabaseClient<Database>;

export async function listarClientes(supabase: Client, busca?: string) {
  if (busca && busca.trim() !== "") {
    // RPC public.buscar_clientes (0001_init.sql): busca tolerante a
    // acento/caixa via unaccent(), respeitando RLS normalmente.
    const { data, error } = await supabase.rpc("buscar_clientes", {
      p_termo: busca.trim(),
    });
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from("cliente")
    .select("*")
    .is("deleted_at", null)
    .order("nome");

  if (error) throw error;
  return data;
}

export async function buscarClientePorId(supabase: Client, id: string) {
  const { data, error } = await supabase
    .from("cliente")
    .select("*, veiculo(*)")
    .eq("id", id)
    .is("deleted_at", null)
    .filter("veiculo.deleted_at", "is", null)
    .single();

  if (error) throw error;
  return data;
}

export async function criarCliente(
  supabase: Client,
  workshopId: string,
  usuarioId: string,
  dados: ClienteInput
) {
  const { data, error } = await supabase
    .from("cliente")
    .insert({
      workshop_id: workshopId,
      created_by: usuarioId,
      tipo: dados.tipo,
      nome: dados.nome,
      documento: dados.documento,
      telefone: dados.telefone,
      email: dados.email || null,
      cep: dados.cep,
      logradouro: dados.logradouro,
      numero: dados.numero,
      complemento: dados.complemento || null,
      bairro: dados.bairro || null,
      cidade: dados.cidade || null,
      estado: dados.estado || null,
      origem: dados.origem || null,
      notas: dados.notas || null,
      consente_email: dados.consenteEmail,
      consente_sms: dados.consenteSms,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function atualizarCliente(
  supabase: Client,
  id: string,
  dados: ClienteInput
) {
  const { data, error } = await supabase
    .from("cliente")
    .update({
      tipo: dados.tipo,
      nome: dados.nome,
      documento: dados.documento,
      telefone: dados.telefone,
      email: dados.email || null,
      cep: dados.cep,
      logradouro: dados.logradouro,
      numero: dados.numero,
      complemento: dados.complemento || null,
      bairro: dados.bairro || null,
      cidade: dados.cidade || null,
      estado: dados.estado || null,
      origem: dados.origem || null,
      notas: dados.notas || null,
      consente_email: dados.consenteEmail,
      consente_sms: dados.consenteSms,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function softDeleteCliente(supabase: Client, id: string) {
  const { error } = await supabase
    .from("cliente")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}
