import type { Database, TipoMovimentacaoEstoque } from "@/lib/supabase/database.types";

export type Peca = Database["public"]["Tables"]["peca"]["Row"];
export type MovimentacaoEstoque = Database["public"]["Tables"]["movimentacao_estoque"]["Row"];
export type { TipoMovimentacaoEstoque };

export const TIPO_MOVIMENTACAO_LABEL: Record<TipoMovimentacaoEstoque, string> = {
  entrada: "Entrada",
  saida_consumo: "Saída (consumo em OS)",
  devolucao: "Devolução",
  perda: "Perda/Avaria",
  ajuste: "Ajuste de inventário",
};

export const UNIDADES_SUGERIDAS = ["UN", "PC", "PAR", "CX", "L", "KG", "M"] as const;

export type NivelEstoque = "ok" | "baixo" | "zerado";

export type MovimentacaoComOrdem = MovimentacaoEstoque & {
  ordem_servico: { numero: number } | null;
};
