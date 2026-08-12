"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { orcamentoSchema } from "@/lib/validators/orcamento.schema";
import { diagnosticoSchema } from "@/lib/validators/diagnostico.schema";
import {
  aprovarOrcamento,
  atualizarItensOrcamento,
  atualizarOsAposAprovacao,
  buscarOrcamentoRascunhoDaOs,
  buscarStatusOrcamento,
  cancelarOrcamento,
  criarOrcamento,
  criarOrcamentoDaOs,
  haPecaAprovadaSemEstoque,
  marcarOrcamentoEnviado,
  recusarOrcamento,
  type DiagnosticoRascunho,
} from "@/modules/orcamento/data/orcamento.repository";
import {
  erroOrcamentoFinalizado,
  orcamentoTemDesfecho,
} from "@/modules/orcamento/domain/status";
import { mensagemDeErro } from "@/modules/financeiro/application/erros";
import { exigirSessao, type ActionResult } from "@/lib/action-result";

export type { ActionResult };

export async function criarOrcamentoAction(
  entrada: unknown
): Promise<ActionResult<{ id: string }>> {
  const guard = await exigirSessao();
  if (!guard.ok) return guard;

  const parsed = orcamentoSchema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  try {
    const id = await criarOrcamento(
      supabase,
      guard.sessao.workshopId,
      guard.sessao.usuarioId,
      parsed.data
    );
    revalidatePath("/orcamentos");
    return { ok: true, data: { id } };
  } catch (e) {
    return {
      ok: false,
      erro: mensagemDeErro(e, "Não foi possível criar o orçamento. Tente novamente."),
    };
  }
}

// Carrega o diagnóstico (rascunho vinculado à OS) para prefill do dialog.
// Sem sessão, `throw`: a RLS devolveria null e o dialog abriria em branco, como
// se a OS não tivesse diagnóstico — e a Michele redigitaria tudo por cima.
export async function buscarDiagnosticoAction(
  ordemId: string
): Promise<DiagnosticoRascunho | null> {
  const guard = await exigirSessao();
  if (!guard.ok) throw new Error(guard.erro);

  const supabase = await createClient();
  return buscarOrcamentoRascunhoDaOs(supabase, ordemId);
}

// Salva o diagnóstico: reaproveita o rascunho da OS se já existir (edita os
// itens), senão cria um novo já vinculado à OS. É o passo que faz a mesma
// lista viver do diagnóstico até a compra, sem redigitar.
export async function salvarDiagnosticoAction(
  ordemId: string,
  entrada: unknown
): Promise<ActionResult<{ orcamentoId: string }>> {
  const guard = await exigirSessao();
  if (!guard.ok) return guard;

  const parsed = diagnosticoSchema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  try {
    const existente = await buscarOrcamentoRascunhoDaOs(supabase, ordemId);
    let orcamentoId: string;
    if (existente) {
      await atualizarItensOrcamento(supabase, existente.orcamentoId, parsed.data.itens);
      orcamentoId = existente.orcamentoId;
    } else {
      orcamentoId = await criarOrcamentoDaOs(
        supabase,
        ordemId,
        guard.sessao.usuarioId,
        parsed.data.itens
      );
    }
    revalidatePath("/patio");
    revalidatePath("/orcamentos");
    return { ok: true, data: { orcamentoId } };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e, "Não foi possível salvar o diagnóstico.") };
  }
}

export async function marcarOrcamentoEnviadoAction(id: string): Promise<ActionResult<null>> {
  const guard = await exigirSessao();
  if (!guard.ok) return guard;

  const supabase = await createClient();
  try {
    const status = await buscarStatusOrcamento(supabase, id);
    if (orcamentoTemDesfecho(status)) {
      return { ok: false, erro: erroOrcamentoFinalizado(status, "marcar como enviado") };
    }

    await marcarOrcamentoEnviado(supabase, id);
    revalidatePath(`/orcamentos/${id}`);
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e, "Não foi possível marcar como enviado.") };
  }
}

export async function aprovarOrcamentoAction(
  id: string,
  itensAprovadosIds: string[]
): Promise<ActionResult<{ ordemServicoId: string; faltaPeca: boolean }>> {
  const guard = await exigirSessao();
  if (!guard.ok) return guard;

  const supabase = await createClient();
  try {
    // Guard mais importante dos quatro: aprovar de novo geraria uma segunda
    // leva de pedidos de compra para as mesmas peças.
    const status = await buscarStatusOrcamento(supabase, id);
    if (orcamentoTemDesfecho(status)) {
      return { ok: false, erro: erroOrcamentoFinalizado(status, "aprovar") };
    }

    const ordemServicoId = await aprovarOrcamento(
      supabase,
      id,
      itensAprovadosIds,
      guard.sessao.usuarioId
    );

    // Pós-aprovação: se sobrou peça a comprar, a OS vai para "aguardando peça";
    // senão, é liberada para execução.
    const faltaPeca = await haPecaAprovadaSemEstoque(supabase, id);
    await atualizarOsAposAprovacao(supabase, ordemServicoId, faltaPeca);

    revalidatePath(`/orcamentos/${id}`);
    revalidatePath("/patio");
    return { ok: true, data: { ordemServicoId, faltaPeca } };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e, "Não foi possível aprovar o orçamento.") };
  }
}

export async function recusarOrcamentoAction(id: string): Promise<ActionResult<null>> {
  const guard = await exigirSessao();
  if (!guard.ok) return guard;

  const supabase = await createClient();
  try {
    const status = await buscarStatusOrcamento(supabase, id);
    if (orcamentoTemDesfecho(status)) {
      return { ok: false, erro: erroOrcamentoFinalizado(status, "recusar") };
    }

    await recusarOrcamento(supabase, id);
    revalidatePath(`/orcamentos/${id}`);
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e, "Não foi possível recusar o orçamento.") };
  }
}

export async function cancelarOrcamentoAction(id: string): Promise<ActionResult<null>> {
  const guard = await exigirSessao();
  if (!guard.ok) return guard;

  const supabase = await createClient();
  try {
    const status = await buscarStatusOrcamento(supabase, id);
    if (orcamentoTemDesfecho(status)) {
      return { ok: false, erro: erroOrcamentoFinalizado(status, "cancelar") };
    }

    await cancelarOrcamento(supabase, id);
    revalidatePath(`/orcamentos/${id}`);
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e, "Não foi possível cancelar o orçamento.") };
  }
}
