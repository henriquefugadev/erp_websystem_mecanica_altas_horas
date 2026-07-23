import type { Database, StatusPedidoCompra } from "@/lib/supabase/database.types";

export type Fornecedor = Database["public"]["Tables"]["fornecedor"]["Row"];
export type PedidoCompra = Database["public"]["Tables"]["pedido_compra"]["Row"];
export type PedidoCompraItem = Database["public"]["Tables"]["pedido_compra_item"]["Row"];
export type RecebimentoCompra = Database["public"]["Tables"]["recebimento_compra"]["Row"];
export type RecebimentoItem = Database["public"]["Tables"]["recebimento_item"]["Row"];
export type { StatusPedidoCompra };

export const STATUS_PEDIDO_LABEL: Record<StatusPedidoCompra, string> = {
  aberto: "Aberto",
  parcial: "Parcial",
  recebido: "Recebido",
  cancelado: "Cancelado",
};

export type PedidoComRelacoes = PedidoCompra & {
  fornecedor: { nome: string } | null;
  categoria_financeira: { nome: string } | null;
  ordem_servico: { numero: number; queixa: string } | null;
  pedido_compra_item: PedidoCompraItem[];
  recebimento_compra: (RecebimentoCompra & { conta_financeira: { status: string } | null })[];
};
