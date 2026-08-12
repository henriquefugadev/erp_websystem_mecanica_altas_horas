"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessaoAtual } from "@/lib/supabase/sessao";
import {
  pedidoCompraSchema,
  recebimentoSchema,
  type PedidoCompraInput,
  type RecebimentoInput,
} from "@/lib/validators/pedido-compra.schema";
import {
  buscarPedidoPorId,
  buscarStatusOrdem,
  cancelarPedido,
  criarPedido,
  gerarPedidosDoOrcamento,
  receberPedido,
  resumoPedidosDoOrcamento,
} from "@/modules/fornecedores/data/pedido-compra.repository";
import { podeCancelar, podeReceber } from "@/modules/fornecedores/domain/pedido";
import { STATUS_PEDIDO_LABEL } from "@/modules/fornecedores/domain/types";
import { mensagemDeErro } from "@/modules/financeiro/application/erros";
import type { ActionResult } from "@/lib/action-result";

export type { ActionResult };

export async function criarPedidoAction(
  entrada: unknown
): Promise<ActionResult<{ id: string }>> {
  const sessao = await getSessaoAtual();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Faça login novamente." };

  const parsed = pedidoCompraSchema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  try {
    const id = await criarPedido(supabase, sessao.workshopId, sessao.usuarioId, parsed.data);
    revalidatePath("/compras");
    return { ok: true, data: { id } };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e, "Não foi possível criar o pedido. Tente novamente.") };
  }
}

export async function receberPedidoAction(
  id: string,
  entrada: unknown
): Promise<ActionResult<{ recebimentoId: string; osLiberada: number | null }>> {
  const sessao = await getSessaoAtual();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Faça login novamente." };

  const parsed = recebimentoSchema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  try {
    const pedido = await buscarPedidoPorId(supabase, id);
    if (!podeReceber(pedido.status)) {
      return {
        ok: false,
        erro: `Pedido está "${STATUS_PEDIDO_LABEL[pedido.status]}", não é possível registrar recebimento.`,
      };
    }

    // Estado da OS antes do recebimento: se estava esperando peça, pode ser
    // liberada quando as peças chegarem.
    const osAntes = pedido.ordem_servico_id
      ? await buscarStatusOrdem(supabase, pedido.ordem_servico_id)
      : null;
    const esperavaPeca =
      osAntes?.status === "parado" && osAntes.motivoParada === "aguardando_peca";

    const recebimentoId = await receberPedido(supabase, id, sessao.usuarioId, parsed.data);

    // Confirma se o recebimento de fato liberou a OS (só quando veio completo).
    let osLiberada: number | null = null;
    if (esperavaPeca && pedido.ordem_servico_id) {
      const osDepois = await buscarStatusOrdem(supabase, pedido.ordem_servico_id);
      if (osDepois?.status === "aguardando" && osDepois.motivoParada === null) {
        osLiberada = osDepois.numero;
      }
    }

    revalidatePath("/compras");
    revalidatePath(`/compras/${id}`);
    revalidatePath("/financeiro/contas");
    revalidatePath("/financeiro");
    revalidatePath("/patio");
    return { ok: true, data: { recebimentoId, osLiberada } };
  } catch (e) {
    return {
      ok: false,
      erro: mensagemDeErro(e, "Não foi possível registrar o recebimento. Tente novamente."),
    };
  }
}

// Gera os pedidos de compra a partir do orçamento aprovado (um por
// fornecedor). Bloqueia se já foram gerados ou se não há nada a comprar.
export async function gerarPedidosDoOrcamentoAction(
  orcamentoId: string,
  categoriaId: string
): Promise<ActionResult<{ quantidade: number }>> {
  const sessao = await getSessaoAtual();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Faça login novamente." };
  if (!categoriaId) return { ok: false, erro: "Selecione a categoria de despesa." };

  const supabase = await createClient();
  try {
    const resumo = await resumoPedidosDoOrcamento(supabase, orcamentoId);
    if (resumo.jaGerado) {
      return { ok: false, erro: "Os pedidos deste orçamento já foram gerados." };
    }
    if (resumo.grupos.length === 0) {
      return {
        ok: false,
        erro: "Nenhuma peça aprovada com fornecedor e custo definidos para comprar.",
      };
    }

    const pedidoIds = await gerarPedidosDoOrcamento(
      supabase,
      orcamentoId,
      categoriaId,
      sessao.usuarioId
    );
    revalidatePath("/compras");
    revalidatePath(`/orcamentos/${orcamentoId}`);
    revalidatePath("/patio");
    return { ok: true, data: { quantidade: pedidoIds.length } };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e, "Não foi possível gerar os pedidos de compra.") };
  }
}

export async function cancelarPedidoAction(id: string): Promise<ActionResult<null>> {
  const sessao = await getSessaoAtual();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Faça login novamente." };

  const supabase = await createClient();
  try {
    const pedido = await buscarPedidoPorId(supabase, id);
    if (!podeCancelar(pedido.status)) {
      return {
        ok: false,
        erro: `Pedido está "${STATUS_PEDIDO_LABEL[pedido.status]}", não é possível cancelar.`,
      };
    }

    await cancelarPedido(supabase, id);
    revalidatePath("/compras");
    revalidatePath(`/compras/${id}`);
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e, "Não foi possível cancelar o pedido. Tente novamente.") };
  }
}

export type { PedidoCompraInput, RecebimentoInput };
