"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessaoAtual } from "@/lib/supabase/sessao";
import { categoriaSchema, type CategoriaInput } from "@/lib/validators/financeiro.schema";
import {
  atualizarCategoria,
  criarCategoria,
  softDeleteCategoria,
} from "@/modules/financeiro/data/categoria.repository";
import { mensagemDeErro } from "./erros";
import type { ActionResult } from "@/lib/action-result";

export type { ActionResult };

export async function criarCategoriaAction(
  entrada: unknown
): Promise<ActionResult<{ id: string }>> {
  const sessao = await getSessaoAtual();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Faça login novamente." };

  const parsed = categoriaSchema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  try {
    const categoria = await criarCategoria(supabase, sessao.workshopId, parsed.data);
    revalidatePath("/financeiro/categorias");
    return { ok: true, data: { id: categoria.id } };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e, "Não foi possível salvar. Tente novamente.") };
  }
}

export async function atualizarCategoriaAction(
  id: string,
  entrada: unknown
): Promise<ActionResult<{ id: string }>> {
  const sessao = await getSessaoAtual();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Faça login novamente." };

  const parsed = categoriaSchema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  try {
    await atualizarCategoria(supabase, id, parsed.data);
    revalidatePath("/financeiro/categorias");
    return { ok: true, data: { id } };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e, "Não foi possível salvar. Tente novamente.") };
  }
}

export async function excluirCategoriaAction(id: string): Promise<ActionResult<null>> {
  const sessao = await getSessaoAtual();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Faça login novamente." };

  const supabase = await createClient();
  try {
    await softDeleteCategoria(supabase, id);
    revalidatePath("/financeiro/categorias");
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e, "Não foi possível excluir. Tente novamente.") };
  }
}

export type { CategoriaInput };
