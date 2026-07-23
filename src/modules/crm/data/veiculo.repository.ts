import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { VeiculoInput } from "@/lib/validators/veiculo.schema";

type Client = SupabaseClient<Database>;

export async function criarVeiculo(
  supabase: Client,
  workshopId: string,
  clienteId: string,
  dados: VeiculoInput
) {
  const { data, error } = await supabase
    .from("veiculo")
    .insert({
      workshop_id: workshopId,
      cliente_id: clienteId,
      placa: dados.placa,
      marca: dados.marca || null,
      modelo: dados.modelo,
      ano: dados.ano ?? null,
      cor: dados.cor || null,
      quilometragem: dados.quilometragem ?? null,
      notas: dados.notas || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function atualizarVeiculo(
  supabase: Client,
  id: string,
  dados: VeiculoInput
) {
  const { data, error } = await supabase
    .from("veiculo")
    .update({
      placa: dados.placa,
      marca: dados.marca || null,
      modelo: dados.modelo,
      ano: dados.ano ?? null,
      cor: dados.cor || null,
      quilometragem: dados.quilometragem ?? null,
      notas: dados.notas || null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function softDeleteVeiculo(supabase: Client, id: string) {
  const { error } = await supabase
    .from("veiculo")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}
