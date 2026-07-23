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
