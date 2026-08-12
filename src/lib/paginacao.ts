/**
 * Paginação das listagens.
 *
 * Nenhuma lista tinha limite: `/clientes`, `/financeiro/contas`, `/estoque`,
 * `/compras` e `/orcamentos` traziam a tabela inteira e montavam uma linha de
 * HTML para cada registro. Enquanto o sistema tinha dados de teste isso não
 * aparecia; com o histórico da oficina importado, aparece.
 *
 * O formato é "mostrar mais" acumulativo por parâmetro de URL, e não páginas
 * numeradas: a Michele procura por busca/filtro, não navega por página, e assim
 * a lista continua sendo uma lista só (dá para usar Ctrl+F do navegador, e o
 * link continua compartilhável). O custo é refazer a consulta com um limite
 * maior a cada clique — limitado pelo teto abaixo.
 */
export const PAGINA = 50;

/** Teto de segurança: nem com cliques repetidos a tela puxa a tabela toda. */
export const LIMITE_MAXIMO = 500;

/** Converte o `?mostrar=` da URL num limite válido. Lixo vira a primeira página. */
export function limiteDaUrl(mostrar: string | undefined): number {
  const pedido = Number(mostrar);
  if (!Number.isFinite(pedido) || pedido <= 0) return PAGINA;
  // Arredonda para o múltiplo de PAGINA acima, para o parâmetro não virar um
  // jeito de pedir uma quantidade arbitrária de linhas.
  return Math.min(Math.ceil(pedido / PAGINA) * PAGINA, LIMITE_MAXIMO);
}

/**
 * As listagens pedem uma linha a mais do que vão mostrar: se ela veio, existe
 * pelo menos mais um registro e o botão "Mostrar mais" faz sentido.
 */
export function recortar<T>(linhas: T[], limite: number): { itens: T[]; temMais: boolean } {
  const temMais = linhas.length > limite;
  return { itens: temMais ? linhas.slice(0, limite) : linhas, temMais };
}
