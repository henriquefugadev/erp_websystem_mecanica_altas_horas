import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export interface PontoFluxoCaixa {
  dia: string;
  entradas: number;
  saidas: number;
}

export async function buscarResumo(supabase: Client, de: string, ate: string) {
  const { data, error } = await supabase
    .rpc("financeiro_resumo", { p_de: de, p_ate: ate })
    .single();

  if (error) throw error;
  return data;
}

export async function buscarFluxoCaixa(
  supabase: Client,
  de: string,
  ate: string
): Promise<PontoFluxoCaixa[]> {
  const { data, error } = await supabase.rpc("financeiro_fluxo_caixa", {
    p_de: de,
    p_ate: ate,
  });

  if (error) throw error;
  return preencherDiasFaltantes(de, ate, data ?? []);
}

export async function buscarInadimplencia(supabase: Client) {
  const { data, error } = await supabase
    .from("vw_inadimplencia")
    .select("*")
    .order("dias_atraso", { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * O RPC só retorna dias com pagamento; o gráfico precisa de todos os dias
 * do período (com zero) para não distorcer a leitura do fluxo de caixa.
 */
function preencherDiasFaltantes(
  de: string,
  ate: string,
  linhas: { dia: string; entradas: number; saidas: number }[]
): PontoFluxoCaixa[] {
  const porDia = new Map(linhas.map((l) => [l.dia, l]));
  const resultado: PontoFluxoCaixa[] = [];

  const inicio = Date.UTC(...partesData(de));
  const fim = Date.UTC(...partesData(ate));

  for (let t = inicio; t <= fim; t += 24 * 60 * 60 * 1000) {
    const dia = new Date(t).toISOString().slice(0, 10);
    const linha = porDia.get(dia);
    resultado.push({
      dia,
      entradas: linha ? Number(linha.entradas) : 0,
      saidas: linha ? Number(linha.saidas) : 0,
    });
  }

  return resultado;
}

function partesData(data: string): [number, number, number] {
  const [ano, mes, dia] = data.split("-").map(Number);
  return [ano, mes - 1, dia];
}
