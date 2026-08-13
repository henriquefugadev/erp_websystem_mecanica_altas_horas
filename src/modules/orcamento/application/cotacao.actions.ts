"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { cotacoesSchema } from "@/lib/validators/cotacao.schema";
import {
  listarItensCotadosDoOrcamento,
  salvarCotacoes,
} from "@/modules/orcamento/data/cotacao.repository";
import { buscarConfiguracao } from "@/modules/workshop/data/workshop.repository";
import { aplicarMarkup } from "@/modules/orcamento/domain/calculo";
import { mensagemDeErro } from "@/modules/financeiro/application/erros";
import { exigirSessao, type ActionResult } from "@/lib/action-result";

export type { ActionResult };

// Salva as cotações digitadas de uma vez. O preço de venda é calculado aqui
// (servidor) com o markup da oficina — o cliente nunca manda o preço, só o
// custo, para não dar pra burlar a margem.
export async function salvarCotacoesAction(entrada: unknown): Promise<ActionResult<null>> {
  const guard = await exigirSessao();
  if (!guard.ok) return guard;

  const parsed = cotacoesSchema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  if (parsed.data.itens.length === 0) return { ok: true, data: null };

  const supabase = await createClient();
  try {
    const workshop = await buscarConfiguracao(supabase, guard.sessao.workshopId);
    const markup = workshop.markup_peca_percentual;

    const itens = parsed.data.itens.map((i) => ({
      id: i.id,
      fornecedorId: i.fornecedorId || null,
      custoCotado: i.custoCotado,
      precoUnitario: i.custoCotado != null ? aplicarMarkup(i.custoCotado, markup) : null,
    }));

    await salvarCotacoes(supabase, itens);
    revalidatePath("/cotacoes");
    revalidatePath("/orcamentos");
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e, "Não foi possível salvar as cotações.") };
  }
}

// Recalcula o preço de venda de todos os itens cotados de um orçamento com o
// markup atual da oficina — útil quando a Michele mudou o markup depois de
// cotar, ou ajustou preços na mão e quer voltar ao sugerido.
export async function reaplicarMarkupAction(
  orcamentoId: string
): Promise<ActionResult<{ atualizados: number }>> {
  const guard = await exigirSessao();
  if (!guard.ok) return guard;

  const supabase = await createClient();
  try {
    const [workshop, itens] = await Promise.all([
      buscarConfiguracao(supabase, guard.sessao.workshopId),
      listarItensCotadosDoOrcamento(supabase, orcamentoId),
    ]);
    if (itens.length === 0) return { ok: true, data: { atualizados: 0 } };

    const markup = workshop.markup_peca_percentual;
    await salvarCotacoes(
      supabase,
      itens.map((i) => ({
        id: i.id,
        fornecedorId: i.fornecedorId,
        custoCotado: i.custoCotado,
        precoUnitario: aplicarMarkup(i.custoCotado, markup),
      }))
    );

    revalidatePath(`/orcamentos/${orcamentoId}`);
    return { ok: true, data: { atualizados: itens.length } };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e, "Não foi possível reaplicar o markup.") };
  }
}
