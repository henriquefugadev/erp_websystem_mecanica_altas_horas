import type { NivelEstoque, Peca, TipoMovimentacaoEstoque } from "./types";

/**
 * Regras puras de estoque, isoladas do banco para serem testáveis
 * diretamente — mesmo padrão de fornecedores/domain/pedido.ts e
 * financeiro/domain/baixa.ts. Espelham a lógica de
 * app.aplicar_movimento_estoque e consumir_peca_os/ajustar_estoque
 * (0008_estoque.sql), usadas para exibição/validação otimista no client
 * antes da chamada ao RPC.
 */

type PecaComSaldo = Pick<Peca, "estoque_atual" | "estoque_minimo">;

export function nivelEstoque(peca: PecaComSaldo): NivelEstoque {
  if (peca.estoque_atual <= 0) return "zerado";
  if (peca.estoque_atual <= peca.estoque_minimo) return "baixo";
  return "ok";
}

export function abaixoDoMinimo(peca: PecaComSaldo): boolean {
  return nivelEstoque(peca) !== "ok";
}

/**
 * Mesma fórmula de app.aplicar_movimento_estoque: custo médio ponderado
 * entre o estoque já em mãos e a nova entrada.
 */
export function custoMedioPonderado(
  estoqueAnterior: number,
  custoMedioAnterior: number,
  quantidadeCompra: number,
  custoUnitarioCompra: number
): number {
  const novoEstoque = estoqueAnterior + quantidadeCompra;
  const total = estoqueAnterior * custoMedioAnterior + quantidadeCompra * custoUnitarioCompra;
  return Math.round((total / novoEstoque + Number.EPSILON) * 100) / 100;
}

/**
 * Sinal (+/-) que o tipo de movimentação aplica sobre o saldo — mesma regra
 * do CHECK movimentacao_estoque_sinal_por_tipo. 'ajuste' fica de fora: seu
 * sinal vem direto da quantidade contada pelo usuário, não é fixo por tipo.
 */
export function sinalPorTipo(tipo: Exclude<TipoMovimentacaoEstoque, "ajuste">): 1 | -1 {
  return tipo === "saida_consumo" || tipo === "perda" ? -1 : 1;
}
