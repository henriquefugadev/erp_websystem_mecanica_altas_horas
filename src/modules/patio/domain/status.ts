import type { StatusOS } from "@/lib/supabase/database.types";
import {
  PARAMETROS_PADRAO,
  type ParametrosPatio,
} from "@/modules/workshop/domain/parametros";
import { CAPACIDADE_GALPAO, GALPOES, type Galpao } from "./types";

/**
 * Regras de transição/atenção do pátio, isoladas do banco para serem
 * testáveis puramente — mesmo padrão de src/modules/financeiro/domain/baixa.ts.
 */

const TRANSICOES: Record<StatusOS, StatusOS[]> = {
  aguardando: ["aguardando_confirmacao", "em_execucao", "cancelada"],
  // "Esperando confirmação do cliente": aguarda o OK do orçamento. Pode ir pra
  // execução (aprovou), voltar pra fila (adiar) ou ser cancelada (recusou).
  aguardando_confirmacao: ["em_execucao", "aguardando", "cancelada"],
  em_execucao: ["aguardando", "aguardando_confirmacao", "parado", "concluido"],
  parado: ["em_execucao", "cancelada"],
  concluido: [],
  cancelada: [],
};

export function transicaoPermitida(de: StatusOS, para: StatusOS): boolean {
  return TRANSICOES[de].includes(para);
}

// Além desse tempo sem avançar, o card ganha o badge de atenção. Pausa
// costuma ser esperada (cliente trazendo peça aos poucos), por isso o
// limite de 'parado' é bem mais folgado que os outros dois.
// Estes são os PADRÕES — a oficina pode sobrescrever cada um nas Configurações
// (workshop.sla_*), que chegam aqui pelo parâmetro opcional `limites`.
export const LIMITE_AGUARDANDO_HORAS = PARAMETROS_PADRAO.slaAguardandoHoras;
export const LIMITE_EXECUCAO_HORAS = PARAMETROS_PADRAO.slaExecucaoHoras;
export const LIMITE_PARADO_HORAS = PARAMETROS_PADRAO.slaParadoHoras; // 7 dias
// Cliente demorando pra confirmar o orçamento merece cobrança da Michele —
// limite intermediário (aproveita data_pausa, carimbada ao entrar na coluna).
export const LIMITE_CONFIRMACAO_HORAS = PARAMETROS_PADRAO.slaConfirmacaoHoras;

export type NivelAtencao = "ok" | "atencao";

/** Prazos de atenção em horas. Aceita o objeto de parâmetros da oficina. */
export type LimitesAtencao = Pick<
  ParametrosPatio,
  "slaAguardandoHoras" | "slaConfirmacaoHoras" | "slaExecucaoHoras" | "slaParadoHoras"
>;

const LIMITES_PADRAO: LimitesAtencao = {
  slaAguardandoHoras: LIMITE_AGUARDANDO_HORAS,
  slaConfirmacaoHoras: LIMITE_CONFIRMACAO_HORAS,
  slaExecucaoHoras: LIMITE_EXECUCAO_HORAS,
  slaParadoHoras: LIMITE_PARADO_HORAS,
};

export function nivelAtencao(
  status: StatusOS,
  dataAbertura: Date,
  dataInicio: Date | null,
  dataPausa: Date | null,
  agora: Date,
  limites: LimitesAtencao = LIMITES_PADRAO
): NivelAtencao {
  if (status === "aguardando") {
    return horasEntre(dataAbertura, agora) >= limites.slaAguardandoHoras ? "atencao" : "ok";
  }
  if (status === "aguardando_confirmacao" && dataPausa) {
    return horasEntre(dataPausa, agora) >= limites.slaConfirmacaoHoras ? "atencao" : "ok";
  }
  if (status === "em_execucao" && dataInicio) {
    return horasEntre(dataInicio, agora) >= limites.slaExecucaoHoras ? "atencao" : "ok";
  }
  if (status === "parado" && dataPausa) {
    return horasEntre(dataPausa, agora) >= limites.slaParadoHoras ? "atencao" : "ok";
  }
  return "ok";
}

function horasEntre(inicio: Date, fim: Date): number {
  return (fim.getTime() - inicio.getTime()) / (1000 * 60 * 60);
}

export interface OrdemParaLotacao {
  galpao: number | null;
  status: StatusOS;
}

// 'parado' e 'aguardando_confirmacao' continuam ocupando a vaga física — o
// carro não saiu do galpão enquanto espera peça, pagamento ou o OK do cliente.
const STATUS_OCUPA_GALPAO: StatusOS[] = ["em_execucao", "parado", "aguardando_confirmacao"];

export function lotacaoGalpoes(
  ordens: OrdemParaLotacao[],
  galpoes: Galpao[] = GALPOES
): Record<Galpao, number> {
  const contagem: Record<Galpao, number> = {};
  for (const g of galpoes) contagem[g] = 0;

  for (const ordem of ordens) {
    if (!ordem.galpao || !STATUS_OCUPA_GALPAO.includes(ordem.status)) continue;
    // Carro numa baia que a oficina removeu depois (diminuiu a quantidade de
    // galpões) não some da conta — vira uma chave a mais, e o quadro mostra.
    contagem[ordem.galpao] = (contagem[ordem.galpao] ?? 0) + 1;
  }
  return contagem;
}

/** Galpão sugerido ao iniciar uma OS: o menos ocupado no momento. */
export function galpaoMenosOcupado(
  ordens: OrdemParaLotacao[],
  galpoes: Galpao[] = GALPOES,
  capacidade: number = CAPACIDADE_GALPAO
): { galpao: Galpao; lotado: boolean } {
  const contagem = lotacaoGalpoes(ordens, galpoes);
  const [galpao, quantidade] = galpoes
    .map((g) => [g, contagem[g] ?? 0] as const)
    .reduce((menor, atual) => (atual[1] < menor[1] ? atual : menor));

  return { galpao, lotado: quantidade >= capacidade };
}

export type StatusPagamento = "sem_cobranca" | "pendente" | "parcial" | "pago";

/** Deriva o status de pagamento da OS a partir das contas ligadas a ela. */
export function statusPagamento(contas: { status: string }[]): StatusPagamento {
  if (contas.length === 0) return "sem_cobranca";
  const liquidadas = contas.filter((c) => c.status === "liquidada").length;
  if (liquidadas === contas.length) return "pago";
  if (liquidadas > 0) return "parcial";
  return "pendente";
}
