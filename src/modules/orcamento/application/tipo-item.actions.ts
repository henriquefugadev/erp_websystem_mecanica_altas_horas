"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessaoAtual } from "@/lib/supabase/sessao";
import { tipoItemSchema } from "@/lib/validators/tipo-item.schema";
import {
  atualizarTipoItem,
  criarTipoItem,
  excluirTipoItem,
} from "@/modules/orcamento/data/tipo-item.repository";
import { mensagemDeErro } from "@/modules/financeiro/application/erros";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; erro: string };

// Parametrização é de configuração — só o admin (Jadson) altera. A RLS já
// bloqueia a escrita, isso barra mais cedo com mensagem clara.
async function exigirAdmin() {
  const sessao = await getSessaoAtual();
  if (!sessao) return { ok: false as const, erro: "Sessão expirada. Faça login novamente." };
  if (sessao.papel !== "admin") {
    return { ok: false as const, erro: "Só o administrador pode alterar os tipos." };
  }
  return { ok: true as const, sessao };
}

function revalidar() {
  revalidatePath("/configuracoes");
  revalidatePath("/patio");
}

export async function criarTipoItemAction(entrada: unknown): Promise<ActionResult<null>> {
  const guard = await exigirAdmin();
  if (!guard.ok) return guard;

  const parsed = tipoItemSchema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  try {
    await criarTipoItem(supabase, guard.sessao.workshopId, parsed.data);
    revalidar();
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e, "Não foi possível criar o tipo. Já existe um com esse nome?") };
  }
}

export async function atualizarTipoItemAction(
  id: string,
  entrada: unknown
): Promise<ActionResult<null>> {
  const guard = await exigirAdmin();
  if (!guard.ok) return guard;

  const parsed = tipoItemSchema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  try {
    await atualizarTipoItem(supabase, id, parsed.data);
    revalidar();
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e, "Não foi possível salvar o tipo. Já existe um com esse nome?") };
  }
}

export async function excluirTipoItemAction(
  id: string
): Promise<ActionResult<{ desativado: boolean }>> {
  const guard = await exigirAdmin();
  if (!guard.ok) return guard;

  const supabase = await createClient();
  try {
    const resultado = await excluirTipoItem(supabase, id);
    revalidar();
    return { ok: true, data: { desativado: resultado.desativado } };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e, "Não foi possível excluir o tipo. Tente novamente.") };
  }
}
