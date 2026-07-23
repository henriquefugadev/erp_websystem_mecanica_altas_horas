"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessaoAtual } from "@/lib/supabase/sessao";
import { workshopSchema } from "@/lib/validators/workshop.schema";
import {
  atualizarConfiguracao,
  enviarLogo,
  removerLogo,
} from "@/modules/workshop/data/workshop.repository";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; erro: string };

const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];
const TAMANHO_MAXIMO = 4 * 1024 * 1024; // 4MB

// Configurações é restrito ao admin (Jadson) — RLS já bloqueia a escrita no
// banco, isso barra mais cedo com mensagem clara em vez de deixar o Postgres
// rejeitar silenciosamente (update sem policy afeta 0 linhas, sem erro).
async function exigirAdmin() {
  const sessao = await getSessaoAtual();
  if (!sessao) return { ok: false as const, erro: "Sessão expirada. Faça login novamente." };
  if (sessao.papel !== "admin") {
    return { ok: false as const, erro: "Só o administrador pode alterar as configurações." };
  }
  return { ok: true as const, sessao };
}

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
    revalidatePath("/configuracoes");
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
