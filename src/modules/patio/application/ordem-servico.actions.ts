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
  buscarOrdemPorId,
  cancelarOrdem,
  concluirOrdem,
  criarOrdem,
  iniciarOrdem,
  listarOrdensDoQuadro,
  moverGalpao,
  pausarOrdem,
  retomarOrdem,
  voltarParaAguardando,
} from "@/modules/patio/data/ordem-servico.repository";
import { galpaoMenosOcupado, transicaoPermitida } from "@/modules/patio/domain/status";
import { GALPOES, STATUS_OS_LABEL, type Galpao } from "@/modules/patio/domain/types";
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

export async function pausarOrdemAction(id: string): Promise<ActionResult<null>> {
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

    await pausarOrdem(supabase, id);
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

export type { OrdemServicoInput };
