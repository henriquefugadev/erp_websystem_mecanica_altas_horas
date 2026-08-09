import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { OrcamentoOutput } from "@/lib/validators/orcamento.schema";
import type { DiagnosticoOutput } from "@/lib/validators/diagnostico.schema";
import type { OrcamentoComCliente, OrcamentoComRelacoes } from "../domain/types";
import { precisaComprarPeca } from "../domain/aprovacao";

type Client = SupabaseClient<Database>;

// Rascunho de orçamento visto pela ótica do diagnóstico: só os campos que a
// tela de diagnóstico precisa para prefill/edição. Preço/custo/fornecedor
// viajam junto para não serem apagados numa reedição.
export interface DiagnosticoRascunho {
  orcamentoId: string;
  itens: {
    tipo: "peca" | "servico";
    tipoNome: string | null;
    descricao: string;
    quantidade: number;
    pecaId: string | null;
    fornecedorId: string | null;
    precoUnitario: number;
    desconto: number;
    custoCotado: number | null;
  }[];
}

// Converte os itens validados (camelCase) para o jsonb que as RPCs
// criar_orcamento_da_os / atualizar_itens_orcamento esperam (snake_case).
function mapItensDiagnostico(itens: DiagnosticoOutput["itens"]) {
  return itens.map((item) => ({
    tipo: item.tipo,
    tipo_nome: item.tipoNome || null,
    descricao: item.descricao,
    quantidade: item.quantidade,
    peca_id: item.pecaId || null,
    fornecedor_id: item.fornecedorId || null,
    preco_unitario: item.precoUnitario ?? 0,
    desconto: item.desconto ?? 0,
    custo_cotado: item.custoCotado ?? null,
  }));
}

const SELECT_LISTA = "*, cliente(nome), veiculo(placa, modelo, marca)";

const SELECT_DETALHE =
  "*, cliente(nome, telefone), veiculo(placa, modelo, marca, ano, cor, quilometragem), " +
  "orcamento_item(*), ordem_servico(numero)";

export async function listarOrcamentos(supabase: Client) {
  const { data, error } = await supabase
    .from("vw_orcamento")
    .select(SELECT_LISTA)
    .order("numero", { ascending: false })
    .overrideTypes<OrcamentoComCliente[], { merge: false }>();

  if (error) throw error;
  return data;
}

// Calcula o status "efetivo" (a mesma regra da view vw_orcamento): um orçamento
// enviado cuja validade já passou aparece como "expirado". Feito em JS porque a
// busca de detalhe lê da TABELA base, não da view — o embedding de relações
// (orcamento_item, ordem_servico) via PostgREST em cima de uma view é frágil e
// era a causa do "Orçamento não encontrado" ao baixar o PDF de um rascunho.
function calcularStatusEfetivo(
  status: OrcamentoComRelacoes["status"],
  validade: string
): OrcamentoComRelacoes["status_efetivo"] {
  if (status === "enviado" && validade < new Date().toISOString().slice(0, 10)) {
    return "expirado";
  }
  return status;
}

export async function buscarOrcamentoPorId(
  supabase: Client,
  id: string
): Promise<OrcamentoComRelacoes> {
  const { data, error } = await supabase
    .from("orcamento")
    .select(SELECT_DETALHE)
    .eq("id", id)
    .is("deleted_at", null)
    .single()
    .overrideTypes<Omit<OrcamentoComRelacoes, "status_efetivo">, { merge: false }>();

  if (error) throw error;
  return {
    ...data,
    orcamento_item: [...data.orcamento_item].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    status_efetivo: calcularStatusEfetivo(data.status, data.validade),
  };
}

export async function criarOrcamento(
  supabase: Client,
  workshopId: string,
  usuarioId: string,
  dados: OrcamentoOutput
) {
  const { data, error } = await supabase.rpc("criar_orcamento", {
    p_workshop_id: workshopId,
    p_cliente_id: dados.clienteId,
    p_veiculo_id: dados.veiculoId,
    p_queixa: dados.queixa,
    p_observacoes: dados.observacoes || null,
    p_condicoes_pagamento: dados.condicoesPagamento || null,
    p_validade: dados.validade,
    p_itens: dados.itens.map((item) => ({
      tipo: item.tipo,
      peca_id: item.pecaId || null,
      descricao: item.descricao,
      quantidade: item.quantidade,
      preco_unitario: item.precoUnitario,
      desconto: item.desconto,
    })),
    p_created_by: usuarioId,
  });

  if (error) throw error;
  return data as string;
}

// Cria (ou reaproveita) o rascunho do orçamento vinculado a uma OS.
export async function criarOrcamentoDaOs(
  supabase: Client,
  ordemId: string,
  usuarioId: string,
  itens: DiagnosticoOutput["itens"]
) {
  const { data, error } = await supabase.rpc("criar_orcamento_da_os", {
    p_ordem_id: ordemId,
    p_itens: mapItensDiagnostico(itens),
    p_created_by: usuarioId,
  });
  if (error) throw error;
  return data as string;
}

// Substitui os itens de um rascunho existente (reedição do diagnóstico).
export async function atualizarItensOrcamento(
  supabase: Client,
  orcamentoId: string,
  itens: DiagnosticoOutput["itens"]
) {
  const { error } = await supabase.rpc("atualizar_itens_orcamento", {
    p_orcamento_id: orcamentoId,
    p_itens: mapItensDiagnostico(itens),
  });
  if (error) throw error;
}

// Rascunho vinculado à OS (se houver), com os itens já em camelCase para o
// front prefill. Retorna null quando a OS ainda não tem diagnóstico.
export async function buscarOrcamentoRascunhoDaOs(
  supabase: Client,
  ordemId: string
): Promise<DiagnosticoRascunho | null> {
  const { data, error } = await supabase
    .from("orcamento")
    .select(
      "id, orcamento_item(tipo, tipo_nome, descricao, quantidade, peca_id, fornecedor_id, preco_unitario, desconto, custo_cotado, created_at)"
    )
    .eq("ordem_servico_id", ordemId)
    .eq("status", "rascunho")
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const itens = [...data.orcamento_item]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((i) => ({
      tipo: i.tipo,
      tipoNome: i.tipo_nome,
      descricao: i.descricao,
      quantidade: i.quantidade,
      pecaId: i.peca_id,
      fornecedorId: i.fornecedor_id,
      precoUnitario: i.preco_unitario,
      desconto: i.desconto,
      custoCotado: i.custo_cotado,
    }));

  return { orcamentoId: data.id, itens };
}

export async function marcarOrcamentoEnviado(supabase: Client, id: string) {
  const { error } = await supabase
    .from("orcamento")
    .update({ status: "enviado", enviado_em: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

export async function recusarOrcamento(supabase: Client, id: string) {
  const { error } = await supabase
    .from("orcamento")
    .update({ status: "recusado", respondido_em: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

export async function cancelarOrcamento(supabase: Client, id: string) {
  const { error } = await supabase.from("orcamento").update({ status: "cancelado" }).eq("id", id);
  if (error) throw error;
}

// Há alguma peça APROVADA que precisa ser comprada? (sem peça no catálogo ou
// estoque atual menor que a quantidade). Decide se a OS vai para
// "aguardando peça" depois da aprovação.
export async function haPecaAprovadaSemEstoque(
  supabase: Client,
  orcamentoId: string
): Promise<boolean> {
  type Row = {
    quantidade: number;
    peca_id: string | null;
    peca: { estoque_atual: number } | null;
  };

  const { data, error } = await supabase
    .from("orcamento_item")
    .select("quantidade, peca_id, peca(estoque_atual)")
    .eq("orcamento_id", orcamentoId)
    .eq("tipo", "peca")
    .eq("aprovado", true)
    .overrideTypes<Row[], { merge: false }>();

  if (error) throw error;
  return precisaComprarPeca(
    data.map((i) => ({
      pecaId: i.peca_id,
      quantidade: i.quantidade,
      estoqueAtual: i.peca?.estoque_atual ?? null,
    }))
  );
}

// Ajusta a OS logo após a aprovação do cliente:
// - falta peça  → "parado" com motivo "aguardando_peca" (destrava no
//   recebimento do pedido, Fase 6);
// - tudo em estoque/serviço → libera para execução, tirando a pausa de
//   "aguardando aprovação" (só quando estava parada por isso).
export async function atualizarOsAposAprovacao(
  supabase: Client,
  ordemId: string,
  faltaPeca: boolean
): Promise<void> {
  if (faltaPeca) {
    const { error } = await supabase
      .from("ordem_servico")
      .update({
        status: "parado",
        motivo_parada: "aguardando_peca",
        data_pausa: new Date().toISOString(),
      })
      .eq("id", ordemId)
      .not("status", "in", "(concluido,cancelada)");
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from("ordem_servico")
    .update({ status: "aguardando", motivo_parada: null, data_pausa: null, galpao: null })
    .eq("id", ordemId)
    .eq("status", "parado");
  if (error) throw error;
}

// Retorna o id da nova ordem de serviço gerada.
export async function aprovarOrcamento(
  supabase: Client,
  orcamentoId: string,
  itensAprovadosIds: string[],
  usuarioId: string
) {
  const { data, error } = await supabase.rpc("aprovar_orcamento", {
    p_orcamento_id: orcamentoId,
    p_itens_aprovados: itensAprovadosIds,
    p_created_by: usuarioId,
  });

  if (error) throw error;
  return data as string;
}
