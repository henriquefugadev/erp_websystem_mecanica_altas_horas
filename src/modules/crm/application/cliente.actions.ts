"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessaoAtual } from "@/lib/supabase/sessao";
import { clienteSchema, type ClienteInput } from "@/lib/validators/cliente.schema";
import {
  atualizarCliente,
  criarCliente,
  listarClientes,
  softDeleteCliente,
} from "@/modules/crm/data/cliente.repository";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; erro: string };

export interface VeiculoOpcaoBusca {
  id: string;
  placa: string;
  modelo: string;
  marca: string | null;
}

export interface ClienteOpcaoBusca {
  id: string;
  nome: string;
  veiculo: VeiculoOpcaoBusca[];
}

const LIMITE_RESULTADOS_BUSCA = 20;

// Alimenta o combobox de cliente (ex.: Nova OS, orçamento) sob demanda, em vez
// de carregar todos os clientes+veículos de uma vez — busca tolerante a
// acento via buscar_clientes() (0001_init.sql) e busca os veículos só dos
// clientes encontrados.
export async function buscarClientesComVeiculosAction(
  termo: string
): Promise<ClienteOpcaoBusca[]> {
  const supabase = await createClient();
  const clientes = await listarClientes(supabase, termo);
  const encontrados = clientes.slice(0, LIMITE_RESULTADOS_BUSCA);

  if (encontrados.length === 0) return [];

  const { data: veiculos, error } = await supabase
    .from("veiculo")
    .select("id, placa, modelo, marca, cliente_id")
    .in(
      "cliente_id",
      encontrados.map((c) => c.id)
    )
    .is("deleted_at", null);

  if (error) throw error;

  return encontrados.map((c) => ({
    id: c.id,
    nome: c.nome,
    veiculo: (veiculos ?? [])
      .filter((v) => v.cliente_id === c.id)
      .map((v) => ({ id: v.id, placa: v.placa, modelo: v.modelo, marca: v.marca })),
  }));
}

export async function criarClienteAction(
  entrada: unknown
): Promise<ActionResult<{ id: string }>> {
  const sessao = await getSessaoAtual();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Faça login novamente." };

  const parsed = clienteSchema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  try {
    const cliente = await criarCliente(
      supabase,
      sessao.workshopId,
      sessao.usuarioId,
      parsed.data
    );
    revalidatePath("/clientes");
    return { ok: true, data: { id: cliente.id } };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e) };
  }
}

export async function atualizarClienteAction(
  id: string,
  entrada: unknown
): Promise<ActionResult<{ id: string }>> {
  const sessao = await getSessaoAtual();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Faça login novamente." };

  const parsed = clienteSchema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  try {
    await atualizarCliente(supabase, id, parsed.data);
    revalidatePath("/clientes");
    revalidatePath(`/clientes/${id}`);
    return { ok: true, data: { id } };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e) };
  }
}

export async function excluirClienteAction(
  id: string
): Promise<ActionResult<null>> {
  const sessao = await getSessaoAtual();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Faça login novamente." };

  const supabase = await createClient();
  try {
    await softDeleteCliente(supabase, id);
    revalidatePath("/clientes");
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e) };
  }
}

function mensagemDeErro(e: unknown): string {
  if (e && typeof e === "object" && "code" in e && e.code === "23505") {
    return "Já existe um cliente com esse documento nesta oficina.";
  }
  return "Não foi possível salvar. Tente novamente.";
}

export type { ClienteInput };
