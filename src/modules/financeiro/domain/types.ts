import type { Database } from "@/lib/supabase/database.types";

export type CategoriaFinanceira = Database["public"]["Tables"]["categoria_financeira"]["Row"];
export type ContaFinanceira = Database["public"]["Tables"]["conta_financeira"]["Row"];
export type ParcelaFinanceira = Database["public"]["Tables"]["parcela_financeira"]["Row"];
export type PagamentoFinanceira = Database["public"]["Tables"]["pagamento_financeira"]["Row"];
export type LinhaInadimplencia = Database["public"]["Views"]["vw_inadimplencia"]["Row"];

export type StatusExibicao =
  | "aberta"
  | "parcial"
  | "liquidada"
  | "cancelada"
  | "vencida";

export type ParcelaComPagamentos = ParcelaFinanceira & {
  pagamentos: PagamentoFinanceira[];
};

export type ContaComParcelas = ContaFinanceira & {
  parcelas: ParcelaComPagamentos[];
  categoria: CategoriaFinanceira | null;
  cliente_nome?: string | null;
};

export const FORMAS_PAGAMENTO = [
  "dinheiro",
  "cartao_credito",
  "cartao_debito",
  "pix",
  "boleto",
] as const;

export const FORMA_PAGAMENTO_LABEL: Record<string, string> = {
  dinheiro: "Dinheiro",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  pix: "PIX",
  boleto: "Boleto",
};

export const STATUS_LABEL: Record<StatusExibicao, string> = {
  aberta: "Em aberto",
  parcial: "Parcial",
  liquidada: "Liquidada",
  cancelada: "Cancelada",
  vencida: "Vencida",
};
