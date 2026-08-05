import { formatarData, formatarDinheiro } from "@/lib/format";
import { calcularSubtotalItem } from "../domain/calculo";
import type { OrcamentoComRelacoes } from "../domain/types";

// montarLinkWhatsApp virou utilitário compartilhado (lib/whatsapp); reexporta
// aqui para não quebrar os imports existentes do módulo de orçamento.
export { montarLinkWhatsApp } from "@/lib/whatsapp";

// Texto plano pronto pra copiar/colar ou mandar por WhatsApp — mesmo
// conteúdo do PDF, sem formatação, seguindo o que docs/pesquisa/05 descreve
// como prática comum do setor (orçamento + link de conversa pré-preenchido).
export function montarTextoOrcamento(orcamento: OrcamentoComRelacoes): string {
  // Itens numerados (1., 2., 3.) — a numeração bate com a do PDF, então o
  // cliente pode responder "aprovo 1 e 3" e a Michele registra a aprovação
  // parcial pelos mesmos números.
  const linhasItens = orcamento.orcamento_item
    .map((item, indice) => {
      const subtotal = calcularSubtotalItem({
        quantidade: item.quantidade,
        precoUnitario: item.preco_unitario,
        desconto: item.desconto,
      });
      return `${indice + 1}. ${item.descricao} (x${item.quantidade}) — ${formatarDinheiro(subtotal)}`;
    })
    .join("\n");

  const veiculo = [orcamento.veiculo?.marca, orcamento.veiculo?.modelo].filter(Boolean).join(" ");

  const partes = [
    `Orçamento #${orcamento.numero}${veiculo ? ` — ${veiculo}` : ""}`,
    "",
    linhasItens,
    "",
    `Total: ${formatarDinheiro(orcamento.valor_total)}`,
    `Válido até: ${formatarData(orcamento.validade)}`,
  ];

  if (orcamento.condicoes_pagamento) {
    partes.push(`Condições de pagamento: ${orcamento.condicoes_pagamento}`);
  }

  partes.push("");
  partes.push("Responda com os números do que quiser aprovar (ex.: 1, 3 e 4).");

  return partes.join("\n");
}
