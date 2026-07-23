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
  cancelarPedido,
  criarPedido,
  receberPedido,
} from "@/modules/fornecedores/data/pedido-compra.repository";
import { podeCancelar, podeReceber } from "@/modules/fornecedores/domain/pedido";
import { STATUS_PEDIDO_LABEL } from "@/modules/fornecedores/domain/types";
import { mensagemDeErro } from "@/modules/financeiro/application/erros";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; erro: string };

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
): Promise<ActionResult<{ recebimentoId: string }>> {
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

    const recebimentoId = await receberPedido(supabase, id, sessao.usuarioId, parsed.data);
    revalidatePath("/compras");
    revalidatePath(`/compras/${id}`);
    revalidatePath("/financeiro/contas");
    revalidatePath("/financeiro");
    return { ok: true, data: { recebimentoId } };
  } catch (e) {
    return {
      ok: false,
      erro: mensagemDeErro(e, "Não foi possível registrar o recebimento. Tente novamente."),
    };
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
