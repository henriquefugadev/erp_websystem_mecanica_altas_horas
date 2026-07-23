"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessaoAtual } from "@/lib/supabase/sessao";
import { consumoPecaSchema } from "@/lib/validators/peca.schema";
import { consumirPecaOs } from "@/modules/estoque/data/movimentacao.repository";
import { mensagemDeErro } from "@/modules/financeiro/application/erros";
import type { ActionResult } from "./peca.actions";

// Baixa automática ao consumir peça numa OS (doc 08) — chamada a partir do
// card do Pátio, com a OS em execução ou parada. Separada da cobrança: só
// dá baixa no estoque e liga o movimento à OS; "Concluir OS" continua
// manual por categoria (decisão de escopo confirmada com o usuário).
export async function consumirPecaOsAction(
  ordemId: string,
  entrada: unknown
): Promise<ActionResult<{ id: string }>> {
  const sessao = await getSessaoAtual();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Faça login novamente." };

  const parsed = consumoPecaSchema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  try {
    const id = await consumirPecaOs(
      supabase,
      sessao.usuarioId,
      ordemId,
      parsed.data.pecaId,
      parsed.data.quantidade
    );
    revalidatePath("/patio");
    revalidatePath("/estoque");
    return { ok: true, data: { id } };
  } catch (e) {
    return {
      ok: false,
      erro: mensagemDeErro(e, "Não foi possível registrar o uso da peça. Tente novamente."),
    };
  }
}
