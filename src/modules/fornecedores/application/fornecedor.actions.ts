"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessaoAtual } from "@/lib/supabase/sessao";
import { fornecedorSchema, type FornecedorInput } from "@/lib/validators/fornecedor.schema";
import {
  atualizarFornecedor,
  criarFornecedor,
  softDeleteFornecedor,
} from "@/modules/fornecedores/data/fornecedor.repository";
import { mensagemDeErro } from "@/modules/financeiro/application/erros";
import type { ActionResult } from "@/lib/action-result";

export type { ActionResult };

export async function criarFornecedorAction(
  entrada: unknown
): Promise<ActionResult<{ id: string }>> {
  const sessao = await getSessaoAtual();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Faça login novamente." };

  const parsed = fornecedorSchema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  try {
    const fornecedor = await criarFornecedor(
      supabase,
      sessao.workshopId,
      sessao.usuarioId,
      parsed.data
    );
    revalidatePath("/fornecedores");
    return { ok: true, data: { id: fornecedor.id } };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e, "Não foi possível salvar. Tente novamente.") };
  }
}

export async function atualizarFornecedorAction(
  id: string,
  entrada: unknown
): Promise<ActionResult<{ id: string }>> {
  const sessao = await getSessaoAtual();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Faça login novamente." };

  const parsed = fornecedorSchema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  try {
    await atualizarFornecedor(supabase, id, parsed.data);
    revalidatePath("/fornecedores");
    revalidatePath(`/fornecedores/${id}`);
    return { ok: true, data: { id } };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e, "Não foi possível salvar. Tente novamente.") };
  }
}

export async function excluirFornecedorAction(id: string): Promise<ActionResult<null>> {
  const sessao = await getSessaoAtual();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Faça login novamente." };

  const supabase = await createClient();
  try {
    await softDeleteFornecedor(supabase, id);
    revalidatePath("/fornecedores");
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e, "Não foi possível excluir. Tente novamente.") };
  }
}

export type { FornecedorInput };
