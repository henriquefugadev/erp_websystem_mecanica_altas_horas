import type { Database } from "@/lib/supabase/database.types";

export type Cliente = Database["public"]["Tables"]["cliente"]["Row"];
export type Veiculo = Database["public"]["Tables"]["veiculo"]["Row"];

export type ClienteComVeiculos = Cliente & { veiculos: Veiculo[] };
