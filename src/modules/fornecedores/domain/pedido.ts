import type { PedidoCompraItem, StatusPedidoCompra } from "./types";

/**
 * Regras puras do pedido de compra, isoladas do banco para serem
 * testáveis diretamente — mesmo padrão de financeiro/domain/baixa.ts e
 * patio/domain/status.ts. Espelham a lógica de public.receber_pedido_compra
 * (0007_fornecedores_compras.sql), usadas para exibição/validação otimista
 * no client antes da chamada ao RPC.
 */

type ItemComSaldo = Pick<PedidoCompraItem, "quantidade" | "quantidade_recebida">;

export function saldoItem(item: ItemComSaldo): number {
  return Math.round((item.quantidade - item.quantidade_recebida) * 1000) / 1000;
}

export function totalPedido(
  itens: Pick<PedidoCompraItem, "quantidade" | "preco_unitario">[]
): number {
  const centavos = itens.reduce(
    (acc, item) => acc + Math.round(item.quantidade * item.preco_unitario * 100),
    0
  );
  return centavos / 100;
}

/** aberto | parcial | recebido — 'cancelado' é decisão explícita, não derivada dos itens. */
export function statusPedido(itens: ItemComSaldo[]): "aberto" | "parcial" | "recebido" {
  if (itens.length === 0) return "aberto";
  if (itens.every((item) => item.quantidade_recebida >= item.quantidade)) return "recebido";
  if (itens.some((item) => item.quantidade_recebida > 0)) return "parcial";
  return "aberto";
}

export function podeReceber(status: StatusPedidoCompra): boolean {
  return status === "aberto" || status === "parcial";
}

export function podeCancelar(status: StatusPedidoCompra): boolean {
  return status === "aberto" || status === "parcial";
}
