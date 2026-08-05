// Decisão pós-aprovação: alguma peça aprovada precisa ser comprada?
// Precisa comprar quando não é item de catálogo (peca_id nulo — texto livre)
// ou quando o estoque atual não cobre a quantidade aprovada. É o que decide se
// a OS vai para "aguardando peça" depois que o cliente aprova.
export interface ItemAprovadoEstoque {
  pecaId: string | null;
  quantidade: number;
  estoqueAtual: number | null;
}

export function precisaComprarPeca(itens: ItemAprovadoEstoque[]): boolean {
  return itens.some(
    (item) => item.pecaId === null || (item.estoqueAtual ?? 0) < item.quantidade
  );
}
