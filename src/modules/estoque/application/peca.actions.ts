"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessaoAtual } from "@/lib/supabase/sessao";
import {
  ajusteSchema,
  movimentacaoSchema,
  pecaSchema,
  type AjusteInput,
  type MovimentacaoInput,
  type PecaInput,
} from "@/lib/validators/peca.schema";
import {
  atualizarPeca,
  criarPeca,
  softDeletePeca,
} from "@/modules/estoque/data/peca.repository";
import {
  ajustarEstoque,
  registrarMovimentacao,
} from "@/modules/estoque/data/movimentacao.repository";
import { mensagemDeErro } from "@/modules/financeiro/application/erros";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; erro: string };

export async function criarPecaAction(entrada: unknown): Promise<ActionResult<{ id: string }>> {
  const sessao = await getSessaoAtual();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Faça login novamente." };

  const parsed = pecaSchema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  try {
    const peca = await criarPeca(supabase, sessao.workshopId, sessao.usuarioId, parsed.data);
    revalidatePath("/estoque");
    return { ok: true, data: { id: peca.id } };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e, "Não foi possível salvar a peça. Tente novamente.") };
  }
}

export async function atualizarPecaAction(
  id: string,
  entrada: unknown
): Promise<ActionResult<{ id: string }>> {
  const sessao = await getSessaoAtual();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Faça login novamente." };

  const parsed = pecaSchema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  try {
    await atualizarPeca(supabase, id, parsed.data);
    revalidatePath("/estoque");
    revalidatePath(`/estoque/${id}`);
    return { ok: true, data: { id } };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e, "Não foi possível salvar a peça. Tente novamente.") };
  }
}

export async function excluirPecaAction(id: string): Promise<ActionResult<null>> {
  const sessao = await getSessaoAtual();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Faça login novamente." };

  const supabase = await createClient();
  try {
    await softDeletePeca(supabase, id);
    revalidatePath("/estoque");
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e, "Não foi possível excluir a peça. Tente novamente.") };
  }
}

export async function registrarMovimentacaoAction(
  entrada: unknown
): Promise<ActionResult<{ id: string }>> {
  const sessao = await getSessaoAtual();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Faça login novamente." };

  const parsed = movimentacaoSchema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  try {
    const movimentacao = await registrarMovimentacao(
      supabase,
      sessao.workshopId,
      sessao.usuarioId,
      parsed.data
    );
    revalidatePath("/estoque");
    revalidatePath(`/estoque/${parsed.data.pecaId}`);
    return { ok: true, data: { id: movimentacao.id } };
  } catch (e) {
    return {
      ok: false,
      erro: mensagemDeErro(e, "Não foi possível registrar a movimentação. Tente novamente."),
    };
  }
}

export async function ajustarEstoqueAction(entrada: unknown): Promise<ActionResult<{ id: string }>> {
  const sessao = await getSessaoAtual();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Faça login novamente." };

  const parsed = ajusteSchema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  try {
    const id = await ajustarEstoque(
      supabase,
      sessao.usuarioId,
      parsed.data.pecaId,
      parsed.data.quantidadeContada,
      parsed.data.observacao || null
    );
    revalidatePath("/estoque");
    revalidatePath(`/estoque/${parsed.data.pecaId}`);
    return { ok: true, data: { id } };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e, "Não foi possível ajustar o estoque. Tente novamente.") };
  }
}

export type { PecaInput, MovimentacaoInput, AjusteInput };
