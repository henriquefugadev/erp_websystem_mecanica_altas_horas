"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { enviarFoto, removerFoto } from "@/modules/crm/data/foto.repository";
import type { ActionResult } from "./cliente.actions";
import { exigirSessao } from "@/lib/action-result";

const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp"];
const TAMANHO_MAXIMO = 8 * 1024 * 1024; // 8MB

export async function enviarFotoAction(
  clienteId: string,
  veiculoId: string,
  formData: FormData
): Promise<ActionResult<{ path: string }>> {
  const guard = await exigirSessao();
  if (!guard.ok) return guard;

  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { ok: false, erro: "Selecione uma foto." };
  }
  if (!TIPOS_ACEITOS.includes(arquivo.type)) {
    return { ok: false, erro: "Formato não suportado. Use JPEG, PNG ou WebP." };
  }
  if (arquivo.size > TAMANHO_MAXIMO) {
    return { ok: false, erro: "Arquivo muito grande (máximo 8MB)." };
  }

  const supabase = await createClient();
  try {
    const path = await enviarFoto(
      supabase,
      guard.sessao.workshopId,
      veiculoId,
      arquivo
    );
    revalidatePath(`/clientes/${clienteId}`);
    return { ok: true, data: { path } };
  } catch {
    return { ok: false, erro: "Não foi possível enviar a foto. Tente novamente." };
  }
}

export async function removerFotoAction(
  clienteId: string,
  path: string
): Promise<ActionResult<null>> {
  const guard = await exigirSessao();
  if (!guard.ok) return guard;

  const supabase = await createClient();
  try {
    await removerFoto(supabase, path);
    revalidatePath(`/clientes/${clienteId}`);
    return { ok: true, data: null };
  } catch {
    return { ok: false, erro: "Não foi possível remover a foto. Tente novamente." };
  }
}
