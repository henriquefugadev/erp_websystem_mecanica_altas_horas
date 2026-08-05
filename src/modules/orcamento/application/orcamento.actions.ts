"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessaoAtual } from "@/lib/supabase/sessao";
import { orcamentoSchema } from "@/lib/validators/orcamento.schema";
import { diagnosticoSchema } from "@/lib/validators/diagnostico.schema";
import {
  aprovarOrcamento,
  atualizarItensOrcamento,
  atualizarOsAposAprovacao,
  buscarOrcamentoRascunhoDaOs,
  cancelarOrcamento,
  criarOrcamento,
  criarOrcamentoDaOs,
  haPecaAprovadaSemEstoque,
  marcarOrcamentoEnviado,
  recusarOrcamento,
  type DiagnosticoRascunho,
} from "@/modules/orcamento/data/orcamento.repository";
import { mensagemDeErro } from "@/modules/financeiro/application/erros";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; erro: string };

export async function criarOrcamentoAction(
  entrada: unknown
): Promise<ActionResult<{ id: string }>> {
  const sessao = await getSessaoAtual();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Faça login novamente." };

  const parsed = orcamentoSchema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  try {
    const id = await criarOrcamento(supabase, sessao.workshopId, sessao.usuarioId, parsed.data);
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
export async function buscarDiagnosticoAction(
  ordemId: string
): Promise<DiagnosticoRascunho | null> {
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
  const sessao = await getSessaoAtual();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Faça login novamente." };

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
      orcamentoId = await criarOrcamentoDaOs(supabase, ordemId, sessao.usuarioId, parsed.data.itens);
    }
    revalidatePath("/patio");
    revalidatePath("/orcamentos");
    return { ok: true, data: { orcamentoId } };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e, "Não foi possível salvar o diagnóstico.") };
  }
}

export async function marcarOrcamentoEnviadoAction(id: string): Promise<ActionResult<null>> {
  const sessao = await getSessaoAtual();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Faça login novamente." };

  const supabase = await createClient();
  try {
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
  const sessao = await getSessaoAtual();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Faça login novamente." };

  const supabase = await createClient();
  try {
    const ordemServicoId = await aprovarOrcamento(
      supabase,
      id,
      itensAprovadosIds,
      sessao.usuarioId
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
  const sessao = await getSessaoAtual();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Faça login novamente." };

  const supabase = await createClient();
  try {
    await recusarOrcamento(supabase, id);
    revalidatePath(`/orcamentos/${id}`);
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e, "Não foi possível recusar o orçamento.") };
  }
}

export async function cancelarOrcamentoAction(id: string): Promise<ActionResult<null>> {
  const sessao = await getSessaoAtual();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Faça login novamente." };

  const supabase = await createClient();
  try {
    await cancelarOrcamento(supabase, id);
    revalidatePath(`/orcamentos/${id}`);
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e, "Não foi possível cancelar o orçamento.") };
  }
}
