import type { StatusOS } from "@/lib/supabase/database.types";
import { CAPACIDADE_GALPAO, GALPOES, type Galpao } from "./types";

/**
 * Regras de transição/atenção do pátio, isoladas do banco para serem
 * testáveis puramente — mesmo padrão de src/modules/financeiro/domain/baixa.ts.
 */

const TRANSICOES: Record<StatusOS, StatusOS[]> = {
  aguardando: ["em_execucao", "cancelada"],
  em_execucao: ["aguardando", "parado", "concluido"],
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
export const LIMITE_AGUARDANDO_HORAS = 24;
export const LIMITE_EXECUCAO_HORAS = 48;
export const LIMITE_PARADO_HORAS = 168; // 7 dias

export type NivelAtencao = "ok" | "atencao";

export function nivelAtencao(
  status: StatusOS,
  dataAbertura: Date,
  dataInicio: Date | null,
  dataPausa: Date | null,
  agora: Date
): NivelAtencao {
  if (status === "aguardando") {
    return horasEntre(dataAbertura, agora) >= LIMITE_AGUARDANDO_HORAS ? "atencao" : "ok";
  }
  if (status === "em_execucao" && dataInicio) {
    return horasEntre(dataInicio, agora) >= LIMITE_EXECUCAO_HORAS ? "atencao" : "ok";
  }
  if (status === "parado" && dataPausa) {
    return horasEntre(dataPausa, agora) >= LIMITE_PARADO_HORAS ? "atencao" : "ok";
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

// 'parado' continua ocupando a vaga física — o carro não saiu do galpão.
export function lotacaoGalpoes(ordens: OrdemParaLotacao[]): Record<Galpao, number> {
  const contagem: Record<Galpao, number> = { 1: 0, 2: 0, 3: 0 };
  for (const ordem of ordens) {
    if ((ordem.status === "em_execucao" || ordem.status === "parado") && ordem.galpao) {
      contagem[ordem.galpao as Galpao] += 1;
    }
  }
  return contagem;
}

/** Galpão sugerido ao iniciar uma OS: o menos ocupado no momento. */
export function galpaoMenosOcupado(
  ordens: OrdemParaLotacao[]
): { galpao: Galpao; lotado: boolean } {
  const contagem = lotacaoGalpoes(ordens);
  const [galpao, quantidade] = GALPOES.map(
    (g) => [g, contagem[g]] as const
  ).reduce((menor, atual) => (atual[1] < menor[1] ? atual : menor));

  return { galpao, lotado: quantidade >= CAPACIDADE_GALPAO };
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
