import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { OrdemServicoInput } from "@/lib/validators/ordem-servico.schema";
import type { Galpao, MotivoParada } from "../domain/types";
import {
  calcularConclusaoDoOrcamento,
  calcularSubtotalItem,
} from "@/modules/orcamento/domain/calculo";

type Client = SupabaseClient<Database>;

export interface ValoresConclusao {
  pecas: number;
  servicos: number;
}

const SELECT_QUADRO =
  "*, cliente(nome, telefone), veiculo(placa, modelo, marca), conta_financeira(status), funcionario(nome)";

export async function listarOrdensDoQuadro(supabase: Client) {
  // O quadro é operacional, não um histórico: OS concluídas somem depois de
  // 7 dias (continuam no banco/relatórios, só saem da visão do dia a dia).
  const seteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("ordem_servico")
    .select(SELECT_QUADRO)
    .is("deleted_at", null)
    .neq("status", "cancelada")
    .or(`status.neq.concluido,data_conclusao.gte.${seteDiasAtras}`)
    .order("numero", { ascending: true });

  if (error) throw error;
  return data;
}

// Quantos itens de diagnóstico (itens do rascunho de orçamento) cada OS já
// tem — alimenta o badge "Diagnóstico: N itens" no card. Uma query só para o
// quadro inteiro, agrupando por OS na aplicação.
export async function contarDiagnosticoPorOs(
  supabase: Client
): Promise<Record<string, number>> {
  type Row = { ordem_servico_id: string | null; orcamento_item: { count: number }[] };

  const { data, error } = await supabase
    .from("orcamento")
    .select("ordem_servico_id, orcamento_item(count)")
    .eq("status", "rascunho")
    .not("ordem_servico_id", "is", null)
    .is("deleted_at", null)
    .overrideTypes<Row[], { merge: false }>();

  if (error) throw error;

  const mapa: Record<string, number> = {};
  for (const row of data) {
    if (!row.ordem_servico_id) continue;
    const total = row.orcamento_item[0]?.count ?? 0;
    mapa[row.ordem_servico_id] = (mapa[row.ordem_servico_id] ?? 0) + total;
  }
  return mapa;
}

// Valor a cobrar sugerido por OS, somando os itens APROVADOS do orçamento
// vinculado, separados por tipo (peças e serviços) — pré-preenche a conclusão
// e serve de total no aviso "carro pronto". Uma query para o quadro inteiro.
export async function valoresConclusaoPorOs(
  supabase: Client
): Promise<Record<string, ValoresConclusao>> {
  type Row = {
    tipo: "peca" | "servico";
    quantidade: number;
    preco_unitario: number;
    desconto: number;
    orcamento: { ordem_servico_id: string | null; status: string; deleted_at: string | null } | null;
  };

  const { data, error } = await supabase
    .from("orcamento_item")
    .select("tipo, quantidade, preco_unitario, desconto, orcamento!inner(ordem_servico_id, status, deleted_at)")
    .eq("aprovado", true)
    .in("orcamento.status", ["aprovado", "aprovado_parcial"])
    .not("orcamento.ordem_servico_id", "is", null)
    .is("orcamento.deleted_at", null)
    .overrideTypes<Row[], { merge: false }>();

  if (error) throw error;

  const porOs = new Map<string, Row[]>();
  for (const item of data) {
    const ordemId = item.orcamento?.ordem_servico_id;
    if (!ordemId) continue;
    const lista = porOs.get(ordemId) ?? [];
    lista.push(item);
    porOs.set(ordemId, lista);
  }

  const resultado: Record<string, ValoresConclusao> = {};
  for (const [ordemId, itens] of porOs) {
    resultado[ordemId] = calcularConclusaoDoOrcamento(
      itens.map((i) => ({
        tipo: i.tipo,
        quantidade: i.quantidade,
        precoUnitario: i.preco_unitario,
        desconto: i.desconto,
      }))
    );
  }
  return resultado;
}

export interface ItemConclusaoRevisao {
  descricao: string;
  tipo: "peca" | "servico";
  valor: number;
}

// Itens APROVADOS do orçamento vinculado à OS, linha a linha (descrição + tipo
// + subtotal) — é o "orçamento que a Michele passou pro cliente" que ela revê
// antes de concluir. Difere de valoresConclusaoPorOs, que só devolve os totais.
export async function buscarItensParaConclusao(
  supabase: Client,
  ordemId: string
): Promise<ItemConclusaoRevisao[]> {
  type Row = {
    tipo: "peca" | "servico";
    descricao: string;
    quantidade: number;
    preco_unitario: number;
    desconto: number;
    orcamento: { ordem_servico_id: string | null; status: string; deleted_at: string | null } | null;
  };

  const { data, error } = await supabase
    .from("orcamento_item")
    .select(
      "tipo, descricao, quantidade, preco_unitario, desconto, orcamento!inner(ordem_servico_id, status, deleted_at), created_at"
    )
    .eq("aprovado", true)
    .eq("orcamento.ordem_servico_id", ordemId)
    .in("orcamento.status", ["aprovado", "aprovado_parcial"])
    .is("orcamento.deleted_at", null)
    .order("created_at", { ascending: true })
    .overrideTypes<Row[], { merge: false }>();

  if (error) throw error;

  return data.map((i) => ({
    descricao: i.descricao,
    tipo: i.tipo,
    valor: calcularSubtotalItem({
      quantidade: i.quantidade,
      precoUnitario: i.preco_unitario,
      desconto: i.desconto,
    }),
  }));
}

export interface ParcelaReceber {
  parcelaId: string;
  contaId: string;
  descricao: string;
  saldo: number;
  vencimento: string;
}

// Parcelas a receber ainda em aberto das contas geradas na conclusão da OS —
// alimenta o "Receber pagamento" quando o cliente busca o carro e paga. Só
// contas do tipo "receber" da OS; o saldo é valor − pago − desconto.
export async function buscarParcelasReceberDaOs(
  supabase: Client,
  ordemId: string
): Promise<ParcelaReceber[]> {
  type Row = {
    id: string;
    conta_id: string;
    valor: number;
    valor_pago: number;
    desconto: number;
    vencimento: string;
    conta_financeira: {
      descricao: string;
      tipo: string;
      ordem_servico_id: string | null;
      deleted_at: string | null;
    } | null;
  };

  const { data, error } = await supabase
    .from("parcela_financeira")
    .select(
      "id, conta_id, valor, valor_pago, desconto, vencimento, conta_financeira!inner(descricao, tipo, ordem_servico_id, deleted_at)"
    )
    .eq("conta_financeira.ordem_servico_id", ordemId)
    .eq("conta_financeira.tipo", "receber")
    .is("conta_financeira.deleted_at", null)
    .in("status", ["aberta", "parcial"])
    .order("vencimento", { ascending: true })
    .overrideTypes<Row[], { merge: false }>();

  if (error) throw error;

  return data.map((p) => ({
    parcelaId: p.id,
    contaId: p.conta_id,
    descricao: p.conta_financeira?.descricao ?? "Conta",
    saldo: Math.round((p.valor - p.valor_pago - p.desconto) * 100) / 100,
    vencimento: p.vencimento,
  }));
}

export async function marcarClienteAvisado(supabase: Client, id: string) {
  const { error } = await supabase
    .from("ordem_servico")
    .update({ cliente_avisado_em: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

export async function buscarOrdemPorId(supabase: Client, id: string) {
  const { data, error } = await supabase
    .from("ordem_servico")
    .select("id, status, galpao, workshop_id, cliente_id")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function criarOrdem(
  supabase: Client,
  workshopId: string,
  usuarioId: string,
  dados: OrdemServicoInput
) {
  const { data, error } = await supabase
    .from("ordem_servico")
    .insert({
      workshop_id: workshopId,
      created_by: usuarioId,
      cliente_id: dados.clienteId,
      veiculo_id: dados.veiculoId,
      queixa: dados.queixa || null,
      descricao: dados.descricao || null,
      funcionario_id: dados.funcionarioId || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function iniciarOrdem(supabase: Client, id: string, galpao: Galpao) {
  const { error } = await supabase
    .from("ordem_servico")
    // Limpa data_pausa: pode vir de "esperando confirmação", que carimba a pausa.
    .update({
      status: "em_execucao",
      data_inicio: new Date().toISOString(),
      galpao,
      data_pausa: null,
      motivo_parada: null,
    })
    .eq("id", id);

  if (error) throw error;
}

// Coloca a OS na coluna "Esperando Confirmação do Cliente". Mantém o galpão e o
// data_inicio (o carro segue na baia) e carimba data_pausa para medir a espera.
export async function enviarParaConfirmacao(supabase: Client, id: string) {
  const { error } = await supabase
    .from("ordem_servico")
    .update({ status: "aguardando_confirmacao", data_pausa: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

// Desfaz o início por engano: volta como se não tivesse começado — libera o
// galpão e limpa data_inicio, pra próxima vez que iniciar carimbar de novo.
export async function voltarParaAguardando(supabase: Client, id: string) {
  const { error } = await supabase
    .from("ordem_servico")
    .update({
      status: "aguardando",
      galpao: null,
      data_inicio: null,
      data_pausa: null,
      motivo_parada: null,
    })
    .eq("id", id);

  if (error) throw error;
}

export async function pausarOrdem(supabase: Client, id: string, motivo?: MotivoParada) {
  const { error } = await supabase
    .from("ordem_servico")
    .update({
      status: "parado",
      data_pausa: new Date().toISOString(),
      motivo_parada: motivo ?? null,
    })
    .eq("id", id);

  if (error) throw error;
}

export async function retomarOrdem(supabase: Client, id: string) {
  const { error } = await supabase
    .from("ordem_servico")
    .update({ status: "em_execucao", data_pausa: null, motivo_parada: null })
    .eq("id", id);

  if (error) throw error;
}

export async function moverGalpao(supabase: Client, id: string, galpao: Galpao) {
  const { error } = await supabase.from("ordem_servico").update({ galpao }).eq("id", id);
  if (error) throw error;
}

export async function cancelarOrdem(supabase: Client, id: string) {
  const { error } = await supabase
    .from("ordem_servico")
    .update({ status: "cancelada" })
    .eq("id", id);

  if (error) throw error;
}

export async function concluirOrdem(
  supabase: Client,
  id: string,
  usuarioId: string,
  dados: {
    vencimento: string | null;
    itens: { categoriaId: string; valor: number }[];
  }
) {
  const { data, error } = await supabase.rpc("concluir_ordem_servico", {
    p_ordem_id: id,
    p_itens: dados.itens.map((item) => ({ categoria_id: item.categoriaId, valor: item.valor })),
    p_vencimento: dados.vencimento,
    p_created_by: usuarioId,
  });

  if (error) throw error;
  return data;
}
