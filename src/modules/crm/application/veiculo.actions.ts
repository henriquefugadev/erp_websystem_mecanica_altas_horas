"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { veiculoSchema } from "@/lib/validators/veiculo.schema";
import {
  atualizarVeiculo,
  criarVeiculo,
  softDeleteVeiculo,
} from "@/modules/crm/data/veiculo.repository";
import type { ActionResult } from "./cliente.actions";
import { exigirSessao } from "@/lib/action-result";

export async function criarVeiculoAction(
  clienteId: string,
  entrada: unknown
): Promise<ActionResult<{ id: string }>> {
  const guard = await exigirSessao();
  if (!guard.ok) return guard;

  const parsed = veiculoSchema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  try {
    const veiculo = await criarVeiculo(
      supabase,
      guard.sessao.workshopId,
      clienteId,
      parsed.data
    );
    revalidatePath(`/clientes/${clienteId}`);
    return { ok: true, data: { id: veiculo.id } };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e) };
  }
}

export async function atualizarVeiculoAction(
  id: string,
  clienteId: string,
  entrada: unknown
): Promise<ActionResult<{ id: string }>> {
  const guard = await exigirSessao();
  if (!guard.ok) return guard;

  const parsed = veiculoSchema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  try {
    await atualizarVeiculo(supabase, id, parsed.data);
    revalidatePath(`/clientes/${clienteId}`);
    return { ok: true, data: { id } };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e) };
  }
}

export async function excluirVeiculoAction(
  id: string,
  clienteId: string
): Promise<ActionResult<null>> {
  const guard = await exigirSessao();
  if (!guard.ok) return guard;

  const supabase = await createClient();
  try {
    await softDeleteVeiculo(supabase, id);
    revalidatePath(`/clientes/${clienteId}`);
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e) };
  }
}

function mensagemDeErro(e: unknown): string {
  if (e && typeof e === "object" && "code" in e && e.code === "23505") {
    return "Já existe um veículo com essa placa nesta oficina.";
  }
  return "Não foi possível salvar. Tente novamente.";
}
