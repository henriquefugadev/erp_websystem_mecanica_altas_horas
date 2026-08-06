export interface ItemCalculavel {
  quantidade: number;
  precoUnitario: number;
  desconto?: number;
}

// Mesma regra de arredondamento de itemConclusaoSchema (ordem-servico.schema.ts):
// sempre pro centavo mais próximo, evitando erro de ponto flutuante (ex.: 0,1+0,2).
function arredondarCentavos(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

// Espelha exatamente a soma feita em criar_orcamento() (0011_orcamentos.sql):
// quantidade × preço unitário − desconto, por item.
export function calcularSubtotalItem(item: ItemCalculavel): number {
  return arredondarCentavos(item.quantidade * item.precoUnitario - (item.desconto ?? 0));
}

export function calcularTotalOrcamento(itens: ItemCalculavel[]): number {
  const total = itens.reduce((soma, item) => soma + calcularSubtotalItem(item), 0);
  return arredondarCentavos(total);
}

// Preço de venda sugerido a partir do custo cotado e do markup (%) da oficina:
// custo × (1 + markup/100), arredondado ao centavo. Fonte única da regra — a
// RPC salvar_cotacoes (0014) só grava o valor calculado aqui, não recalcula.
export function aplicarMarkup(custo: number, markupPercentual: number): number {
  return arredondarCentavos(custo * (1 + markupPercentual / 100));
}

// Soma os itens (já aprovados) por tipo, para pré-preencher a cobrança na
// conclusão da OS: peças numa categoria de receita, serviços em outra. Cada
// subtotal segue a mesma regra de arredondamento do resto do orçamento.
export interface ItemConclusao {
  tipo: "peca" | "servico";
  quantidade: number;
  precoUnitario: number;
  desconto?: number;
}

export function calcularConclusaoDoOrcamento(itens: ItemConclusao[]): {
  pecas: number;
  servicos: number;
} {
  let pecas = 0;
  let servicos = 0;
  for (const item of itens) {
    const subtotal = calcularSubtotalItem(item);
    if (item.tipo === "peca") pecas += subtotal;
    else servicos += subtotal;
  }
  return { pecas: arredondarCentavos(pecas), servicos: arredondarCentavos(servicos) };
}

// Margem sobre o preço de venda: (preço − custo) / preço × 100. Visão interna
// (nunca vai pro cliente), ajuda a Michele a ver quanto sobra em cada peça.
// Retorna null quando não dá pra calcular (sem preço ou sem custo cotado).
export function calcularMargemPercentual(
  precoUnitario: number,
  custo: number | null
): number | null {
  if (custo === null || precoUnitario <= 0) return null;
  return arredondarCentavos(((precoUnitario - custo) / precoUnitario) * 100);
}
