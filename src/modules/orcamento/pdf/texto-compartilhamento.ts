import { formatarData, formatarDinheiro } from "@/lib/format";
import { calcularSubtotalItem } from "../domain/calculo";
import type { OrcamentoComRelacoes } from "../domain/types";

// Texto plano pronto pra copiar/colar ou mandar por WhatsApp — mesmo
// conteúdo do PDF, sem formatação, seguindo o que docs/pesquisa/05 descreve
// como prática comum do setor (orçamento + link de conversa pré-preenchido).
export function montarTextoOrcamento(orcamento: OrcamentoComRelacoes): string {
  const linhasItens = orcamento.orcamento_item
    .map((item) => {
      const subtotal = calcularSubtotalItem({
        quantidade: item.quantidade,
        precoUnitario: item.preco_unitario,
        desconto: item.desconto,
      });
      return `• ${item.descricao} (x${item.quantidade}) — ${formatarDinheiro(subtotal)}`;
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

  return partes.join("\n");
}

export function montarLinkWhatsApp(telefone: string, texto: string): string {
  const digitos = telefone.replace(/\D/g, "");
  return `https://wa.me/55${digitos}?text=${encodeURIComponent(texto)}`;
}
