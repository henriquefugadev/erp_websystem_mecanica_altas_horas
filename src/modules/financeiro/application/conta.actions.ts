"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessaoAtual } from "@/lib/supabase/sessao";
import { contaSchema, type ContaInput } from "@/lib/validators/financeiro.schema";
import { cancelarConta, criarConta } from "@/modules/financeiro/data/conta.repository";
import { mensagemDeErro } from "./erros";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; erro: string };

export async function criarContaAction(
  entrada: unknown
): Promise<ActionResult<{ id: string }>> {
  const sessao = await getSessaoAtual();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Faça login novamente." };

  const parsed = contaSchema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  try {
    const id = await criarConta(supabase, sessao.workshopId, sessao.usuarioId, parsed.data);
    revalidatePath("/financeiro/contas");
    revalidatePath("/financeiro");
    return { ok: true, data: { id } };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e, "Não foi possível salvar. Tente novamente.") };
  }
}

export async function cancelarContaAction(id: string): Promise<ActionResult<null>> {
  const sessao = await getSessaoAtual();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Faça login novamente." };

  const supabase = await createClient();
  try {
    await cancelarConta(supabase, id);
    revalidatePath("/financeiro/contas");
    revalidatePath(`/financeiro/contas/${id}`);
    revalidatePath("/financeiro");
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e, "Não foi possível cancelar. Tente novamente.") };
  }
}

export type { ContaInput };
