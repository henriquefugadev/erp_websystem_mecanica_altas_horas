"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessaoAtual } from "@/lib/supabase/sessao";
import { orcamentoSchema } from "@/lib/validators/orcamento.schema";
import {
  aprovarOrcamento,
  cancelarOrcamento,
  criarOrcamento,
  marcarOrcamentoEnviado,
  recusarOrcamento,
} from "@/modules/orcamento/data/orcamento.repository";
import { mensagemDeErro } from "@/modules/financeiro/application/erros";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; erro: string };

export async function criarOrcamentoAction(
  entrada: unknown
): Promise<ActionResult<{ id: string }>> {
  const sessao = await getSessaoAtual();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Faça login novamente." };

  const parsed = orcamentoSchema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  try {
    const id = await criarOrcamento(supabase, sessao.workshopId, sessao.usuarioId, parsed.data);
    revalidatePath("/orcamentos");
    return { ok: true, data: { id } };
  } catch (e) {
    return {
      ok: false,
      erro: mensagemDeErro(e, "Não foi possível criar o orçamento. Tente novamente."),
    };
  }
}

export async function marcarOrcamentoEnviadoAction(id: string): Promise<ActionResult<null>> {
  const sessao = await getSessaoAtual();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Faça login novamente." };

  const supabase = await createClient();
  try {
    await marcarOrcamentoEnviado(supabase, id);
    revalidatePath(`/orcamentos/${id}`);
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e, "Não foi possível marcar como enviado.") };
  }
}

export async function aprovarOrcamentoAction(
  id: string,
  itensAprovadosIds: string[]
): Promise<ActionResult<{ ordemServicoId: string }>> {
  const sessao = await getSessaoAtual();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Faça login novamente." };

  const supabase = await createClient();
  try {
    const ordemServicoId = await aprovarOrcamento(
      supabase,
      id,
      itensAprovadosIds,
      sessao.usuarioId
    );
    revalidatePath(`/orcamentos/${id}`);
    revalidatePath("/patio");
    return { ok: true, data: { ordemServicoId } };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e, "Não foi possível aprovar o orçamento.") };
  }
}

export async function recusarOrcamentoAction(id: string): Promise<ActionResult<null>> {
  const sessao = await getSessaoAtual();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Faça login novamente." };

  const supabase = await createClient();
  try {
    await recusarOrcamento(supabase, id);
    revalidatePath(`/orcamentos/${id}`);
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e, "Não foi possível recusar o orçamento.") };
  }
}

export async function cancelarOrcamentoAction(id: string): Promise<ActionResult<null>> {
  const sessao = await getSessaoAtual();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Faça login novamente." };

  const supabase = await createClient();
  try {
    await cancelarOrcamento(supabase, id);
    revalidatePath(`/orcamentos/${id}`);
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e, "Não foi possível cancelar o orçamento.") };
  }
}
