"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { servicoCatalogoSchema } from "@/lib/validators/servico-catalogo.schema";
import {
  atualizarServicoCatalogo,
  criarServicoCatalogo,
  excluirServicoCatalogo,
} from "@/modules/servicos/data/servico-catalogo.repository";
import { mensagemDeErro } from "@/modules/financeiro/application/erros";
import { exigirAdmin, type ActionResult } from "@/lib/action-result";

export type { ActionResult };

const ACAO = "alterar o catálogo de serviços";

function revalidar() {
  revalidatePath("/configuracoes");
  revalidatePath("/patio");
}

export async function criarServicoAction(entrada: unknown): Promise<ActionResult<null>> {
  const guard = await exigirAdmin(ACAO);
  if (!guard.ok) return guard;

  const parsed = servicoCatalogoSchema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  try {
    await criarServicoCatalogo(supabase, guard.sessao.workshopId, parsed.data);
    revalidar();
    return { ok: true, data: null };
  } catch (e) {
    return {
      ok: false,
      erro: mensagemDeErro(e, "Não foi possível criar o serviço. Já existe um com esse nome?"),
    };
  }
}

export async function atualizarServicoAction(
  id: string,
  entrada: unknown
): Promise<ActionResult<null>> {
  const guard = await exigirAdmin(ACAO);
  if (!guard.ok) return guard;

  const parsed = servicoCatalogoSchema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  try {
    await atualizarServicoCatalogo(supabase, id, parsed.data);
    revalidar();
    return { ok: true, data: null };
  } catch (e) {
    return {
      ok: false,
      erro: mensagemDeErro(e, "Não foi possível salvar o serviço. Já existe um com esse nome?"),
    };
  }
}

export async function excluirServicoAction(id: string): Promise<ActionResult<null>> {
  const guard = await exigirAdmin(ACAO);
  if (!guard.ok) return guard;

  const supabase = await createClient();
  try {
    await excluirServicoCatalogo(supabase, id);
    revalidar();
    return { ok: true, data: null };
  } catch (e) {
    return {
      ok: false,
      erro: mensagemDeErro(e, "Não foi possível excluir o serviço. Tente novamente."),
    };
  }
}
