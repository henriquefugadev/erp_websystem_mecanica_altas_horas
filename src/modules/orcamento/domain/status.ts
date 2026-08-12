import type { StatusOrcamento } from "@/lib/supabase/database.types";
import { STATUS_ORCAMENTO_LABEL } from "./types";

/**
 * Status em que o orçamento já teve desfecho: o cliente respondeu (aprovou,
 * aprovou em parte ou recusou) ou a oficina cancelou. Nada mais muda a partir
 * daqui — aprovar de novo um orçamento já aprovado geraria uma segunda leva de
 * pedidos de compra para as mesmas peças.
 *
 * Compara o status GRAVADO, não o efetivo: "expirado" é estado derivado da
 * data de validade e não impede resposta — cliente que liga depois do prazo
 * ainda aprova, que é o comportamento de hoje.
 *
 * A tela de orçamento já escondia os botões nesses status, mas a regra vivia
 * solta no componente. Agora mora aqui e é a mesma que o servidor aplica —
 * botão escondido é conveniência, a barreira de verdade é a do servidor.
 */
export const STATUS_ORCAMENTO_FINAIS: StatusOrcamento[] = [
  "aprovado",
  "aprovado_parcial",
  "recusado",
  "cancelado",
];

export function orcamentoTemDesfecho(status: StatusOrcamento): boolean {
  return STATUS_ORCAMENTO_FINAIS.includes(status);
}

/** Mensagem pronta para a tela quando a ação é recusada pelo status. */
export function erroOrcamentoFinalizado(status: StatusOrcamento, acao: string): string {
  return `Orçamento está "${STATUS_ORCAMENTO_LABEL[status]}", não é possível ${acao}.`;
}
