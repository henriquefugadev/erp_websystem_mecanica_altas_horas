"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

import { workshopSchema } from "@/lib/validators/workshop.schema";
import {
  atualizarConfiguracao,
  enviarLogo,
  removerLogo,
} from "@/modules/workshop/data/workshop.repository";
import { exigirAdmin, type ActionResult } from "@/lib/action-result";

export type { ActionResult };

const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];
const TAMANHO_MAXIMO = 4 * 1024 * 1024; // 4MB

// Configurações é restrito ao admin (Jadson) — o guard mora em
// @/lib/action-result. A RLS já bloqueia a escrita no banco; barrar aqui dá
// mensagem clara em vez de o Postgres rejeitar silenciosamente (update sem
// policy afeta 0 linhas, sem erro).

export async function atualizarConfiguracaoAction(
  entrada: unknown
): Promise<ActionResult<null>> {
  const guard = await exigirAdmin();
  if (!guard.ok) return guard;

  const parsed = workshopSchema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  try {
    await atualizarConfiguracao(supabase, guard.sessao.workshopId, parsed.data);
    // "/" + "layout" e não "/configuracoes": o que se salva aqui aparece fora
    // desta página. Nome da oficina e itens de menu escondidos vivem na sidebar
    // (o layout), e os parâmetros do pátio mudam as baias do quadro. Revalidar
    // só "/configuracoes" deixaria as outras rotas em cache com o menu antigo.
    revalidatePath("/", "layout");
    return { ok: true, data: null };
  } catch {
    return { ok: false, erro: "Não foi possível salvar. Tente novamente." };
  }
}

export async function enviarLogoAction(
  formData: FormData
): Promise<ActionResult<{ path: string }>> {
  const guard = await exigirAdmin();
  if (!guard.ok) return guard;

  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { ok: false, erro: "Selecione uma imagem." };
  }
  if (!TIPOS_ACEITOS.includes(arquivo.type)) {
    return { ok: false, erro: "Formato não suportado. Use JPEG, PNG, WebP ou SVG." };
  }
  if (arquivo.size > TAMANHO_MAXIMO) {
    return { ok: false, erro: "Arquivo muito grande (máximo 4MB)." };
  }

  const supabase = await createClient();
  try {
    const path = await enviarLogo(supabase, guard.sessao.workshopId, arquivo);
    revalidatePath("/configuracoes");
    return { ok: true, data: { path } };
  } catch {
    return { ok: false, erro: "Não foi possível enviar o logo. Tente novamente." };
  }
}

export async function removerLogoAction(path: string): Promise<ActionResult<null>> {
  const guard = await exigirAdmin();
  if (!guard.ok) return guard;

  const supabase = await createClient();
  try {
    await removerLogo(supabase, guard.sessao.workshopId, path);
    revalidatePath("/configuracoes");
    return { ok: true, data: null };
  } catch {
    return { ok: false, erro: "Não foi possível remover o logo. Tente novamente." };
  }
}
