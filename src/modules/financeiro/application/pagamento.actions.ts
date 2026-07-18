"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessaoAtual } from "@/lib/supabase/sessao";
import { pagamentoSchema, type PagamentoInput } from "@/lib/validators/financeiro.schema";
import {
  estornarPagamento,
  registrarPagamento,
} from "@/modules/financeiro/data/pagamento.repository";
import { mensagemDeErro } from "./erros";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; erro: string };

export async function registrarPagamentoAction(
  parcelaId: string,
  contaId: string,
  entrada: unknown
): Promise<ActionResult<{ id: string }>> {
  const sessao = await getSessaoAtual();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Faça login novamente." };

  const parsed = pagamentoSchema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  try {
    const id = await registrarPagamento(supabase, parcelaId, sessao.usuarioId, parsed.data);
    revalidatePath(`/financeiro/contas/${contaId}`);
    revalidatePath("/financeiro/contas");
    revalidatePath("/financeiro");
    return { ok: true, data: { id } };
  } catch (e) {
    return {
      ok: false,
      erro: mensagemDeErro(e, "Não foi possível registrar o pagamento. Tente novamente."),
    };
  }
}

export async function estornarPagamentoAction(
  pagamentoId: string,
  contaId: string
): Promise<ActionResult<null>> {
  const sessao = await getSessaoAtual();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Faça login novamente." };

  const supabase = await createClient();
  try {
    await estornarPagamento(supabase, pagamentoId, sessao.usuarioId);
    revalidatePath(`/financeiro/contas/${contaId}`);
    revalidatePath("/financeiro/contas");
    revalidatePath("/financeiro");
    return { ok: true, data: null };
  } catch (e) {
    return {
      ok: false,
      erro: mensagemDeErro(e, "Não foi possível estornar o pagamento. Tente novamente."),
    };
  }
}

export type { PagamentoInput };
