import type { StatusOS } from "@/lib/supabase/database.types";
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
export const LIMITE_AGUARDANDO_HORAS = 24;
export const LIMITE_EXECUCAO_HORAS = 48;
export const LIMITE_PARADO_HORAS = 168; // 7 dias
// Cliente demorando pra confirmar o orçamento merece cobrança da Michele —
// limite intermediário (aproveita data_pausa, carimbada ao entrar na coluna).
export const LIMITE_CONFIRMACAO_HORAS = 48;

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
  if (status === "aguardando_confirmacao" && dataPausa) {
    return horasEntre(dataPausa, agora) >= LIMITE_CONFIRMACAO_HORAS ? "atencao" : "ok";
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

// 'parado' e 'aguardando_confirmacao' continuam ocupando a vaga física — o
// carro não saiu do galpão enquanto espera peça, pagamento ou o OK do cliente.
const STATUS_OCUPA_GALPAO: StatusOS[] = ["em_execucao", "parado", "aguardando_confirmacao"];

export function lotacaoGalpoes(ordens: OrdemParaLotacao[]): Record<Galpao, number> {
  const contagem: Record<Galpao, number> = { 1: 0, 2: 0, 3: 0 };
  for (const ordem of ordens) {
    if (STATUS_OCUPA_GALPAO.includes(ordem.status) && ordem.galpao) {
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
