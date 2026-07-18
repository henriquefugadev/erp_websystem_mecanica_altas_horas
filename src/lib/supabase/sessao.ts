import { createClient } from "./server";
import type { Papel } from "./database.types";

export interface SessaoAtual {
  usuarioId: string;
  workshopId: string;
  papel: Papel;
  nome: string;
  email: string;
}

/**
 * Resolve o usuário autenticado + a oficina/papel a que ele pertence.
 * Hoje cada usuário pertence a uma única oficina; o schema já suporta N
 * oficinas por usuário (usuario_workshop), então isso é só um `limit(1)`
 * a mais quando um seletor de oficina for necessário no futuro.
 */
export async function getSessaoAtual(): Promise<SessaoAtual | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: usuario } = await supabase
    .from("usuario")
    .select("nome, email")
    .eq("id", user.id)
    .single();

  const { data: vinculo } = await supabase
    .from("usuario_workshop")
    .select("workshop_id, papel")
    .eq("usuario_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!usuario || !vinculo) return null;

  return {
    usuarioId: user.id,
    workshopId: vinculo.workshop_id,
    papel: vinculo.papel,
    nome: usuario.nome,
    email: usuario.email,
  };
}
