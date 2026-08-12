import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { ClienteInput, ClienteRapidoOutput } from "@/lib/validators/cliente.schema";

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

// Busca da recepção: além de nome/documento/telefone, casa por placa e
// modelo do veículo (RPC buscar_clientes_veiculos, 0012) — que é o dado que a
// Michele costuma ter em mãos no balcão.
export async function buscarClientesEVeiculos(supabase: Client, busca: string) {
  const { data, error } = await supabase.rpc("buscar_clientes_veiculos", {
    p_termo: busca.trim(),
  });
  if (error) throw error;
  return data;
}

// Cadastro relâmpago: só os campos que a recepção tem na hora. Os demais
// ficam nulos e são completados depois na tela de cliente.
export async function criarClienteRapido(
  supabase: Client,
  workshopId: string,
  usuarioId: string,
  dados: ClienteRapidoOutput
) {
  const { data, error } = await supabase
    .from("cliente")
    .insert({
      workshop_id: workshopId,
      created_by: usuarioId,
      tipo: dados.tipo,
      nome: dados.nome,
      telefone: dados.telefone,
      documento: dados.documento ?? null,
    })
    .select()
    .single();

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
      documento: dados.documento || null,
      telefone: dados.telefone,
      email: dados.email || null,
      cep: dados.cep || null,
      logradouro: dados.logradouro || null,
      numero: dados.numero || null,
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
      documento: dados.documento || null,
      telefone: dados.telefone,
      email: dados.email || null,
      cep: dados.cep || null,
      logradouro: dados.logradouro || null,
      numero: dados.numero || null,
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
