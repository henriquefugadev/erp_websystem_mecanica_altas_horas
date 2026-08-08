"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessaoAtual } from "@/lib/supabase/sessao";
import {
  concluirOrdemSchema,
  ordemServicoSchema,
  type OrdemServicoInput,
} from "@/lib/validators/ordem-servico.schema";
import {
  buscarItensParaConclusao,
  buscarOrdemPorId,
  buscarParcelasReceberDaOs,
  cancelarOrdem,
  concluirOrdem,
  criarOrdem,
  enviarParaConfirmacao,
  iniciarOrdem,
  listarOrdensDoQuadro,
  marcarClienteAvisado,
  moverGalpao,
  pausarOrdem,
  retomarOrdem,
  voltarParaAguardando,
  type ItemConclusaoRevisao,
  type ParcelaReceber,
} from "@/modules/patio/data/ordem-servico.repository";
import { registrarPagamento } from "@/modules/financeiro/data/pagamento.repository";
import { receberPagamentoSchema } from "@/lib/validators/financeiro.schema";
import { galpaoMenosOcupado, transicaoPermitida } from "@/modules/patio/domain/status";
import { GALPOES, STATUS_OS_LABEL, type Galpao, type MotivoParada } from "@/modules/patio/domain/types";
import { mensagemDeErro } from "@/modules/financeiro/application/erros";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; erro: string };

export async function criarOrdemAction(
  entrada: unknown
): Promise<ActionResult<{ id: string }>> {
  const sessao = await getSessaoAtual();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Faça login novamente." };

  const parsed = ordemServicoSchema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  try {
    const ordem = await criarOrdem(supabase, sessao.workshopId, sessao.usuarioId, parsed.data);
    revalidatePath("/patio");
    return { ok: true, data: { id: ordem.id } };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e, "Não foi possível abrir a OS. Tente novamente.") };
  }
}

export async function iniciarOrdemAction(
  id: string
): Promise<ActionResult<{ galpao: Galpao; lotado: boolean }>> {
  const sessao = await getSessaoAtual();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Faça login novamente." };

  const supabase = await createClient();
  try {
    const ordem = await buscarOrdemPorId(supabase, id);
    if (!transicaoPermitida(ordem.status, "em_execucao")) {
      return {
        ok: false,
        erro: `OS está "${STATUS_OS_LABEL[ordem.status]}", não é possível iniciar.`,
      };
    }

    const ordens = await listarOrdensDoQuadro(supabase);
    const { galpao, lotado } = galpaoMenosOcupado(ordens);

    await iniciarOrdem(supabase, id, galpao);
    revalidatePath("/patio");
    return { ok: true, data: { galpao, lotado } };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e, "Não foi possível iniciar a OS. Tente novamente.") };
  }
}

export async function voltarOrdemAction(id: string): Promise<ActionResult<null>> {
  const sessao = await getSessaoAtual();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Faça login novamente." };

  const supabase = await createClient();
  try {
    const ordem = await buscarOrdemPorId(supabase, id);
    if (!transicaoPermitida(ordem.status, "aguardando")) {
      return {
        ok: false,
        erro: `OS está "${STATUS_OS_LABEL[ordem.status]}", não é possível voltar.`,
      };
    }

    await voltarParaAguardando(supabase, id);
    revalidatePath("/patio");
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e, "Não foi possível voltar a OS. Tente novamente.") };
  }
}

export async function pausarOrdemAction(
  id: string,
  motivo?: MotivoParada
): Promise<ActionResult<null>> {
  const sessao = await getSessaoAtual();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Faça login novamente." };

  const supabase = await createClient();
  try {
    const ordem = await buscarOrdemPorId(supabase, id);
    if (!transicaoPermitida(ordem.status, "parado")) {
      return {
        ok: false,
        erro: `OS está "${STATUS_OS_LABEL[ordem.status]}", não é possível pausar.`,
      };
    }

    await pausarOrdem(supabase, id, motivo);
    revalidatePath("/patio");
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e, "Não foi possível pausar a OS. Tente novamente.") };
  }
}

export async function retomarOrdemAction(
  id: string
): Promise<ActionResult<{ galpao: Galpao | null }>> {
  const sessao = await getSessaoAtual();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Faça login novamente." };

  const supabase = await createClient();
  try {
    const ordem = await buscarOrdemPorId(supabase, id);
    if (!transicaoPermitida(ordem.status, "em_execucao")) {
      return {
        ok: false,
        erro: `OS está "${STATUS_OS_LABEL[ordem.status]}", não é possível retomar.`,
      };
    }

    await retomarOrdem(supabase, id);
    revalidatePath("/patio");
    return { ok: true, data: { galpao: (ordem.galpao as Galpao) ?? null } };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e, "Não foi possível retomar a OS. Tente novamente.") };
  }
}

// Move a OS para "Esperando Confirmação do Cliente" — enviou o orçamento e
// aguarda o OK. Vem de "aguardando" (antes de começar) ou de "em_execucao"
// (durante o serviço, quando surge algo a aprovar).
export async function enviarConfirmacaoAction(id: string): Promise<ActionResult<null>> {
  const sessao = await getSessaoAtual();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Faça login novamente." };

  const supabase = await createClient();
  try {
    const ordem = await buscarOrdemPorId(supabase, id);
    if (!transicaoPermitida(ordem.status, "aguardando_confirmacao")) {
      return {
        ok: false,
        erro: `OS está "${STATUS_OS_LABEL[ordem.status]}", não é possível enviar para confirmação.`,
      };
    }

    await enviarParaConfirmacao(supabase, id);
    revalidatePath("/patio");
    return { ok: true, data: null };
  } catch (e) {
    return {
      ok: false,
      erro: mensagemDeErro(e, "Não foi possível enviar para confirmação. Tente novamente."),
    };
  }
}

// Cliente aprovou o orçamento: libera a OS para execução. Se ela já tinha
// galpão (veio da execução), retoma na mesma baia; senão, atribui o galpão
// menos ocupado, como um início normal.
export async function confirmarClienteAction(
  id: string
): Promise<ActionResult<{ galpao: Galpao | null }>> {
  const sessao = await getSessaoAtual();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Faça login novamente." };

  const supabase = await createClient();
  try {
    const ordem = await buscarOrdemPorId(supabase, id);
    if (!transicaoPermitida(ordem.status, "em_execucao")) {
      return {
        ok: false,
        erro: `OS está "${STATUS_OS_LABEL[ordem.status]}", não é possível liberar para execução.`,
      };
    }

    if (ordem.galpao) {
      await retomarOrdem(supabase, id);
      revalidatePath("/patio");
      return { ok: true, data: { galpao: ordem.galpao as Galpao } };
    }

    const ordens = await listarOrdensDoQuadro(supabase);
    const { galpao } = galpaoMenosOcupado(ordens);
    await iniciarOrdem(supabase, id, galpao);
    revalidatePath("/patio");
    return { ok: true, data: { galpao } };
  } catch (e) {
    return {
      ok: false,
      erro: mensagemDeErro(e, "Não foi possível liberar a OS. Tente novamente."),
    };
  }
}

export async function moverGalpaoAction(
  id: string,
  galpao: Galpao
): Promise<ActionResult<null>> {
  const sessao = await getSessaoAtual();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Faça login novamente." };
  if (!GALPOES.includes(galpao)) return { ok: false, erro: "Galpão inválido." };

  const supabase = await createClient();
  try {
    await moverGalpao(supabase, id, galpao);
    revalidatePath("/patio");
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e, "Não foi possível mover a OS. Tente novamente.") };
  }
}

export async function cancelarOrdemAction(id: string): Promise<ActionResult<null>> {
  const sessao = await getSessaoAtual();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Faça login novamente." };

  const supabase = await createClient();
  try {
    const ordem = await buscarOrdemPorId(supabase, id);
    if (!transicaoPermitida(ordem.status, "cancelada")) {
      return {
        ok: false,
        erro: `OS está "${STATUS_OS_LABEL[ordem.status]}", não é possível cancelar.`,
      };
    }

    await cancelarOrdem(supabase, id);
    revalidatePath("/patio");
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e, "Não foi possível cancelar a OS. Tente novamente.") };
  }
}

// Carrega o orçamento aprovado da OS (linha a linha) para a Michele revisar
// antes de concluir. Leitura pura — segue o padrão dos outros loaders de dialog.
export async function buscarItensConclusaoAction(
  ordemId: string
): Promise<ItemConclusaoRevisao[]> {
  const supabase = await createClient();
  return buscarItensParaConclusao(supabase, ordemId);
}

// Parcelas a receber em aberto da OS — o dialog de "Receber pagamento" mostra
// o que o cliente ainda deve.
export async function buscarPagamentoOsAction(ordemId: string): Promise<ParcelaReceber[]> {
  const supabase = await createClient();
  return buscarParcelasReceberDaOs(supabase, ordemId);
}

// Registra o recebimento quando o cliente busca o carro e paga: quita o saldo
// integral de cada parcela em aberto da OS, com a forma e a data informadas.
export async function receberPagamentoOsAction(
  ordemId: string,
  entrada: unknown
): Promise<ActionResult<{ pagas: number }>> {
  const sessao = await getSessaoAtual();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Faça login novamente." };

  const parsed = receberPagamentoSchema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  try {
    const parcelas = await buscarParcelasReceberDaOs(supabase, ordemId);
    const aReceber = parcelas.filter((p) => p.saldo > 0);
    if (aReceber.length === 0) {
      return { ok: false, erro: "Não há saldo a receber nesta OS." };
    }

    // Uma baixa por parcela, cada uma pelo saldo integral. A RPC
    // registrar_pagamento valida o saldo e recalcula o status da conta.
    for (const parcela of aReceber) {
      await registrarPagamento(supabase, parcela.parcelaId, sessao.usuarioId, {
        valor: parcela.saldo,
        desconto: 0,
        dataPagamento: parsed.data.dataPagamento,
        formaPagamento: parsed.data.formaPagamento,
        observacoes: parsed.data.observacoes || "",
      });
    }

    revalidatePath("/patio");
    revalidatePath("/financeiro/contas");
    revalidatePath("/financeiro");
    return { ok: true, data: { pagas: aReceber.length } };
  } catch (e) {
    return {
      ok: false,
      erro: mensagemDeErro(e, "Não foi possível registrar o recebimento. Tente novamente."),
    };
  }
}

export async function concluirOrdemAction(
  id: string,
  entrada: unknown
): Promise<ActionResult<{ contaIds: string[] }>> {
  const sessao = await getSessaoAtual();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Faça login novamente." };

  const parsed = concluirOrdemSchema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  try {
    const ordem = await buscarOrdemPorId(supabase, id);
    if (!transicaoPermitida(ordem.status, "concluido")) {
      return {
        ok: false,
        erro: `OS está "${STATUS_OS_LABEL[ordem.status]}", não é possível concluir.`,
      };
    }

    const contaIds = await concluirOrdem(supabase, id, sessao.usuarioId, {
      vencimento: parsed.data.vencimento || null,
      itens: parsed.data.itens,
    });

    revalidatePath("/patio");
    revalidatePath("/financeiro/contas");
    revalidatePath("/financeiro");
    return { ok: true, data: { contaIds } };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e, "Não foi possível concluir a OS. Tente novamente.") };
  }
}

export async function avisarClienteAction(id: string): Promise<ActionResult<null>> {
  const sessao = await getSessaoAtual();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Faça login novamente." };

  const supabase = await createClient();
  try {
    await marcarClienteAvisado(supabase, id);
    revalidatePath("/patio");
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e, "Não foi possível marcar como avisado.") };
  }
}

export type { OrdemServicoInput };
