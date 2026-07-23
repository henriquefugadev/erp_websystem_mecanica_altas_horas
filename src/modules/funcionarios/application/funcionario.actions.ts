"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessaoAtual } from "@/lib/supabase/sessao";
import { funcionarioSchema, type FuncionarioInput } from "@/lib/validators/funcionario.schema";
import {
  atualizarFuncionario,
  criarFuncionario,
  softDeleteFuncionario,
} from "@/modules/funcionarios/data/funcionario.repository";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; erro: string };

export async function criarFuncionarioAction(
  entrada: unknown
): Promise<ActionResult<{ id: string }>> {
  const sessao = await getSessaoAtual();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Faça login novamente." };

  const parsed = funcionarioSchema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  try {
    const funcionario = await criarFuncionario(
      supabase,
      sessao.workshopId,
      sessao.usuarioId,
      parsed.data
    );
    revalidatePath("/funcionarios");
    return { ok: true, data: { id: funcionario.id } };
  } catch {
    return { ok: false, erro: "Não foi possível salvar. Tente novamente." };
  }
}

export async function atualizarFuncionarioAction(
  id: string,
  entrada: unknown
): Promise<ActionResult<{ id: string }>> {
  const sessao = await getSessaoAtual();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Faça login novamente." };

  const parsed = funcionarioSchema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  try {
    await atualizarFuncionario(supabase, id, parsed.data);
    revalidatePath("/funcionarios");
    return { ok: true, data: { id } };
  } catch {
    return { ok: false, erro: "Não foi possível salvar. Tente novamente." };
  }
}

export async function excluirFuncionarioAction(id: string): Promise<ActionResult<null>> {
  const sessao = await getSessaoAtual();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Faça login novamente." };

  const supabase = await createClient();
  try {
    await softDeleteFuncionario(supabase, id);
    revalidatePath("/funcionarios");
    return { ok: true, data: null };
  } catch {
    return { ok: false, erro: "Não foi possível excluir. Tente novamente." };
  }
}

export type { FuncionarioInput };
