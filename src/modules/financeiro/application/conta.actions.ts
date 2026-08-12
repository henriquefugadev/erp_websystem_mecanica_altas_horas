"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { contaSchema, type ContaInput } from "@/lib/validators/financeiro.schema";
import { cancelarConta, criarConta, excluirConta } from "@/modules/financeiro/data/conta.repository";
import { mensagemDeErro } from "./erros";
import { exigirAdmin, exigirSessao, type ActionResult } from "@/lib/action-result";

export type { ActionResult };

export async function criarContaAction(
  entrada: unknown
): Promise<ActionResult<{ id: string }>> {
  const guard = await exigirSessao();
  if (!guard.ok) return guard;

  const parsed = contaSchema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  try {
    const id = await criarConta(
      supabase,
      guard.sessao.workshopId,
      guard.sessao.usuarioId,
      parsed.data
    );
    revalidatePath("/financeiro/contas");
    revalidatePath("/financeiro");
    return { ok: true, data: { id } };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e, "Não foi possível salvar. Tente novamente.") };
  }
}

// Cancelar é operação do dia a dia (a conta continua na lista, com status
// Cancelada) — qualquer usuário logado pode. Só excluir, que tira da vista, é
// restrito ao admin.
export async function cancelarContaAction(id: string): Promise<ActionResult<null>> {
  const guard = await exigirSessao();
  if (!guard.ok) return guard;

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

// Excluir some com o lançamento da lista, do detalhe e do dashboard. É a única
// operação do financeiro que apaga informação da vista da oficina, então fica
// com o Jadson — a RLS não distingue papel aqui, essa é a barreira.
export async function excluirContaAction(id: string): Promise<ActionResult<null>> {
  const guard = await exigirAdmin("excluir lançamentos do financeiro");
  if (!guard.ok) return guard;

  const supabase = await createClient();
  try {
    await excluirConta(supabase, id);
    revalidatePath("/financeiro/contas");
    revalidatePath(`/financeiro/contas/${id}`);
    revalidatePath("/financeiro");
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e, "Não foi possível excluir. Tente novamente.") };
  }
}

export type { ContaInput };
