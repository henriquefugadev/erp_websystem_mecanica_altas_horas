"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessaoAtual } from "@/lib/supabase/sessao";
import { enviarFoto, removerFoto } from "@/modules/crm/data/foto.repository";
import type { ActionResult } from "./cliente.actions";

const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp"];
const TAMANHO_MAXIMO = 8 * 1024 * 1024; // 8MB

export async function enviarFotoAction(
  clienteId: string,
  veiculoId: string,
  formData: FormData
): Promise<ActionResult<{ path: string }>> {
  const sessao = await getSessaoAtual();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Faça login novamente." };

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
      sessao.workshopId,
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
  const sessao = await getSessaoAtual();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Faça login novamente." };

  const supabase = await createClient();
  try {
    await removerFoto(supabase, path);
    revalidatePath(`/clientes/${clienteId}`);
    return { ok: true, data: null };
  } catch {
    return { ok: false, erro: "Não foi possível remover a foto. Tente novamente." };
  }
}
