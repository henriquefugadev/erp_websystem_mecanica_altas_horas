/**
 * Parâmetros operacionais da oficina — os números que antes viviam fixos no
 * código (galpões, prazos de atenção, garantia, janela do quadro).
 *
 * Regra de ouro deste módulo: **sem configuração, o comportamento é o de
 * sempre**. Toda leitura passa por aqui e cai no padrão histórico quando a
 * coluna vem nula/zerada ou quando a migração 0023 ainda não rodou — por isso
 * o tipo de entrada é um subconjunto opcional da linha da workshop, e não a
 * Row inteira.
 *
 * É dado puro (nada de função dentro), porque atravessa a fronteira
 * servidor→client como prop do KanbanBoard.
 */

/** Padrões históricos: o que o sistema fazia antes de existir configuração. */
export const PARAMETROS_PADRAO = {
  galpoesQuantidade: 3,
  capacidadeGalpao: 10,
  slaAguardandoHoras: 24,
  slaConfirmacaoHoras: 48,
  slaExecucaoHoras: 48,
  slaParadoHoras: 168, // 7 dias
  garantiaMeses: 3,
  diasOsConcluidaQuadro: 7,
} as const;

export interface ParametrosPatio {
  /** Números dos galpões, sempre 1..n. */
  galpoes: number[];
  capacidadeGalpao: number;
  /** Rótulo de cada galpão, alinhado com `galpoes` e já com fallback aplicado. */
  nomesGalpao: string[];
  slaAguardandoHoras: number;
  slaConfirmacaoHoras: number;
  slaExecucaoHoras: number;
  slaParadoHoras: number;
  garantiaMeses: number;
  diasOsConcluidaQuadro: number;
  /** Categoria de receita das peças na conclusão. Null = decidir pelo nome. */
  categoriaPecaId: string | null;
  /** Categoria de receita da mão de obra. Null = decidir pelo nome. */
  categoriaMaoObraId: string | null;
}

/** Só o que este módulo lê da workshop — tudo opcional, tudo com fallback. */
export interface FonteParametros {
  galpoes_quantidade?: number | null;
  galpao_capacidade?: number | null;
  galpao_nomes?: string[] | null;
  sla_aguardando_horas?: number | null;
  sla_confirmacao_horas?: number | null;
  sla_execucao_horas?: number | null;
  sla_parado_horas?: number | null;
  garantia_meses_padrao?: number | null;
  dias_os_concluida_quadro?: number | null;
  categoria_peca_id?: string | null;
  categoria_mao_obra_id?: string | null;
}

/** Inteiro positivo dentro da faixa, ou o padrão. Blinda contra 0, NaN e nulo. */
function inteiroOu(valor: number | null | undefined, padrao: number, maximo: number): number {
  if (typeof valor !== "number" || !Number.isFinite(valor)) return padrao;
  const arredondado = Math.trunc(valor);
  if (arredondado < 1 || arredondado > maximo) return padrao;
  return arredondado;
}

export function parametrosPatio(fonte: FonteParametros | null | undefined): ParametrosPatio {
  const quantidade = inteiroOu(fonte?.galpoes_quantidade, PARAMETROS_PADRAO.galpoesQuantidade, 12);
  const galpoes = Array.from({ length: quantidade }, (_, i) => i + 1);
  const nomes = fonte?.galpao_nomes ?? [];

  return {
    galpoes,
    capacidadeGalpao: inteiroOu(
      fonte?.galpao_capacidade,
      PARAMETROS_PADRAO.capacidadeGalpao,
      99
    ),
    // Array curto ou posição em branco cai no "Galpão N" — dá para nomear só
    // o galpão que tem apelido de verdade e deixar o resto numerado.
    nomesGalpao: galpoes.map((n) => nomes[n - 1]?.trim() || `Galpão ${n}`),
    slaAguardandoHoras: inteiroOu(
      fonte?.sla_aguardando_horas,
      PARAMETROS_PADRAO.slaAguardandoHoras,
      8760
    ),
    slaConfirmacaoHoras: inteiroOu(
      fonte?.sla_confirmacao_horas,
      PARAMETROS_PADRAO.slaConfirmacaoHoras,
      8760
    ),
    slaExecucaoHoras: inteiroOu(
      fonte?.sla_execucao_horas,
      PARAMETROS_PADRAO.slaExecucaoHoras,
      8760
    ),
    slaParadoHoras: inteiroOu(fonte?.sla_parado_horas, PARAMETROS_PADRAO.slaParadoHoras, 8760),
    // Garantia aceita 0 ("sem garantia"), então não passa pelo inteiroOu.
    garantiaMeses: garantiaValida(fonte?.garantia_meses_padrao),
    diasOsConcluidaQuadro: inteiroOu(
      fonte?.dias_os_concluida_quadro,
      PARAMETROS_PADRAO.diasOsConcluidaQuadro,
      365
    ),
    categoriaPecaId: fonte?.categoria_peca_id ?? null,
    categoriaMaoObraId: fonte?.categoria_mao_obra_id ?? null,
  };
}

function garantiaValida(valor: number | null | undefined): number {
  if (typeof valor !== "number" || !Number.isFinite(valor)) return PARAMETROS_PADRAO.garantiaMeses;
  const meses = Math.trunc(valor);
  if (meses < 0 || meses > 120) return PARAMETROS_PADRAO.garantiaMeses;
  return meses;
}

/**
 * Data-limite da garantia a partir de uma data-base `yyyy-mm-dd`. Espelha em JS
 * o que a RPC `concluir_ordem_servico` faz no banco (`+ N months`), para o
 * dialog de conclusão mostrar a mesma data que vai ser gravada.
 */
export function calcularGarantiaAte(baseISO: string, meses: number): string {
  const [ano, mes, dia] = baseISO.split("-").map(Number);
  // Date normaliza estouro de mês (nov + 3 = fev do ano seguinte). Dia 31 em
  // mês curto também escorrega — mesmo comportamento do Postgres para o caso
  // comum de meses inteiros.
  const d = new Date(ano, mes - 1 + meses, dia);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

/**
 * Escolhe a categoria financeira de um item na conclusão da OS.
 *
 * Preferência: o que o admin configurou. Sem configuração (ou apontando para
 * categoria que sumiu), cai no critério antigo de adivinhar pelo nome — que é
 * frágil, mas é exatamente o que o sistema já fazia, então nada muda sozinho.
 */
export function escolherCategoriaDoItem(
  natureza: "peca" | "servico",
  categorias: { id: string; nome: string }[],
  parametros: Pick<ParametrosPatio, "categoriaPecaId" | "categoriaMaoObraId">
): string {
  const existe = (id: string | null) =>
    id !== null && categorias.some((c) => c.id === id) ? id : null;

  const configurada =
    natureza === "peca"
      ? existe(parametros.categoriaPecaId)
      : existe(parametros.categoriaMaoObraId);
  if (configurada) return configurada;

  const porNome =
    natureza === "peca"
      ? categorias.find((c) => /pe[çc]a/i.test(c.nome))
      : categorias.find((c) => c.nome.trim().toLowerCase() === "mão de obra");

  return porNome?.id ?? categorias[0]?.id ?? "";
}

/**
 * Uma conta gerada na conclusão é de peça (vs. mão de obra)? Usado para separar
 * o faturamento no card do pátio e no aviso ao cliente.
 *
 * Mesma preferência de `escolherCategoriaDoItem`: categoria configurada manda;
 * sem ela, decide pelo nome — o critério antigo, mantido para não mudar número
 * nenhum de quem ainda não configurou.
 */
export function ehCategoriaDePeca(
  categoria: { id: string | null; nome: string | null },
  parametros: Pick<ParametrosPatio, "categoriaPecaId" | "categoriaMaoObraId">
): boolean {
  if (parametros.categoriaPecaId && categoria.id === parametros.categoriaPecaId) return true;
  if (parametros.categoriaMaoObraId && categoria.id === parametros.categoriaMaoObraId) {
    return false;
  }
  return /pe[çc]a/i.test(categoria.nome ?? "");
}
