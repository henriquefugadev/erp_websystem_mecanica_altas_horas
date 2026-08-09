/**
 * Classificação do faturamento por natureza (peças vs mão de obra/serviço),
 * isolada aqui para ser testável puramente — mesmo padrão de baixa.ts.
 */

export interface LinhaFaturamento {
  categoriaId: string;
  categoriaNome: string;
  total: number;
}

export interface FaturamentoResumo {
  pecas: number;
  servicos: number;
  total: number;
  categorias: LinhaFaturamento[];
}

function arredondarCentavos(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

// Peças vs mão de obra/serviço: tudo que casa com "peça/peças" entra em peças;
// o restante das receitas (mão de obra, outras receitas) entra em serviço — a
// mesma regra por nome usada na conclusão da OS (concluir-os-dialog.tsx).
export function classificarFaturamento(linhas: LinhaFaturamento[]): FaturamentoResumo {
  let pecas = 0;
  let servicos = 0;
  for (const linha of linhas) {
    if (/pe[çc]as?/i.test(linha.categoriaNome)) pecas += linha.total;
    else servicos += linha.total;
  }
  return {
    pecas: arredondarCentavos(pecas),
    servicos: arredondarCentavos(servicos),
    total: arredondarCentavos(pecas + servicos),
    categorias: linhas,
  };
}
