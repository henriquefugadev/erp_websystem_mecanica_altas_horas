"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  clienteSchema,
  clienteRapidoSchema,
  type ClienteInput,
} from "@/lib/validators/cliente.schema";
import { veiculoSchema } from "@/lib/validators/veiculo.schema";
import {
  atualizarCliente,
  buscarClientesEVeiculos,
  criarCliente,
  criarClienteRapido,
  listarClientes,
  softDeleteCliente,
} from "@/modules/crm/data/cliente.repository";
import { criarVeiculo } from "@/modules/crm/data/veiculo.repository";
import { exigirSessao, type ActionResult } from "@/lib/action-result";

export type { ActionResult };

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

// Alimenta o combobox de cliente (ex.: Nova OS, orçamento, entrada) sob
// demanda, em vez de carregar todos os clientes+veículos de uma vez — busca
// tolerante a acento e que casa também por placa/modelo do veículo
// (buscar_clientes_veiculos, 0012), depois traz os veículos só dos clientes
// encontrados.
export async function buscarClientesComVeiculosAction(
  termo: string
): Promise<ClienteOpcaoBusca[]> {
  // Toda action exportada é um endpoint HTTP público. A RLS já devolveria lista
  // vazia sem sessão, mas aí o combobox mostraria "nenhum cliente" como se a
  // oficina não tivesse nenhum. `throw` cai no error.tsx, que explica.
  const guard = await exigirSessao();
  if (!guard.ok) throw new Error(guard.erro);

  const supabase = await createClient();
  const clientes =
    termo.trim() === ""
      ? await listarClientes(supabase)
      : await buscarClientesEVeiculos(supabase, termo);
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

// Cadastro relâmpago da recepção: cria cliente (só nome+telefone) e o veículo
// (placa+modelo) numa tacada e já devolve no formato do combobox, pronto para
// selecionar.
//
// São dois INSERTs, não uma transação. Se o segundo falhar — o caso real é
// placa já cadastrada — o cliente recém-criado é desfeito aqui mesmo. Sem isso
// sobrava um cliente sem veículo nenhum na base, geralmente duplicata de um que
// já existia (a placa repetida é justamente o sinal de que o carro, e portanto
// o dono, já estão cadastrados).
export async function criarClienteComVeiculoAction(
  clienteEntrada: unknown,
  veiculoEntrada: unknown
): Promise<ActionResult<ClienteOpcaoBusca>> {
  const guard = await exigirSessao();
  if (!guard.ok) return guard;

  const clienteParsed = clienteRapidoSchema.safeParse(clienteEntrada);
  if (!clienteParsed.success) {
    return { ok: false, erro: clienteParsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const veiculoParsed = veiculoSchema.safeParse(veiculoEntrada);
  if (!veiculoParsed.success) {
    return { ok: false, erro: veiculoParsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  try {
    const cliente = await criarClienteRapido(
      supabase,
      guard.sessao.workshopId,
      guard.sessao.usuarioId,
      clienteParsed.data
    );

    let veiculo;
    try {
      veiculo = await criarVeiculo(
        supabase,
        guard.sessao.workshopId,
        cliente.id,
        veiculoParsed.data
      );
    } catch (e) {
      // Desfaz o cliente para não deixar cadastro pela metade. Se o desfazer
      // também falhar, seguimos reportando o erro original — é o que a pessoa
      // precisa saber; um cliente órfão é problema menor e some da lista se o
      // soft delete tiver passado.
      await softDeleteCliente(supabase, cliente.id).catch(() => {});
      throw e;
    }

    revalidatePath("/clientes");
    revalidatePath("/patio");
    return {
      ok: true,
      data: {
        id: cliente.id,
        nome: cliente.nome,
        veiculo: [
          {
            id: veiculo.id,
            placa: veiculo.placa,
            modelo: veiculo.modelo,
            marca: veiculo.marca,
          },
        ],
      },
    };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e) };
  }
}

export async function criarClienteAction(
  entrada: unknown
): Promise<ActionResult<{ id: string }>> {
  const guard = await exigirSessao();
  if (!guard.ok) return guard;

  const parsed = clienteSchema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  try {
    const cliente = await criarCliente(
      supabase,
      guard.sessao.workshopId,
      guard.sessao.usuarioId,
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
  const guard = await exigirSessao();
  if (!guard.ok) return guard;

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
  const guard = await exigirSessao();
  if (!guard.ok) return guard;

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
    const detalhe =
      "message" in e && typeof e.message === "string" ? e.message.toLowerCase() : "";
    if (detalhe.includes("placa")) {
      // Placa repetida quase sempre quer dizer "esse carro já está cadastrado",
      // e o caminho é achar o dono, não insistir no cadastro novo.
      return "Já existe um veículo com essa placa. Busque pela placa para achar o cliente.";
    }
    return "Já existe um cliente com esse documento nesta oficina.";
  }
  return "Não foi possível salvar. Tente novamente.";
}

export type { ClienteInput };
