import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { OrdemServicoInput } from "@/lib/validators/ordem-servico.schema";
import type { Galpao, MotivoParada } from "../domain/types";
import { calcularSubtotalItem } from "@/modules/orcamento/domain/calculo";
import { montarHistoricoOs, type HistoricoOs } from "../domain/historico";

type Client = SupabaseClient<Database>;

export interface ValoresConclusao {
  pecas: number;
  servicos: number;
}

const SELECT_QUADRO =
  "*, cliente(nome, telefone), veiculo(placa, modelo, marca, cor), conta_financeira(status), funcionario(nome)";

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
    ordem_servico_id: string | null;
    valor_total: number;
    categoria_financeira: { nome: string } | null;
  };

  const { data, error } = await supabase
    .from("conta_financeira")
    .select("ordem_servico_id, valor_total, categoria_financeira!inner(nome)")
    .eq("tipo", "receber")
    .in("status", ["aberta", "parcial"])
    .not("ordem_servico_id", "is", null)
    .is("deleted_at", null)
    .overrideTypes<Row[], { merge: false }>();

  if (error) throw error;

  const porOs = new Map<string, Row[]>();
  for (const item of data) {
    const ordemId = item.ordem_servico_id;
    if (!ordemId) continue;
    const lista = porOs.get(ordemId) ?? [];
    lista.push(item);
    porOs.set(ordemId, lista);
  }

  const resultado: Record<string, ValoresConclusao> = {};
  for (const [ordemId, itens] of porOs) {
    resultado[ordemId] = itens.reduce<ValoresConclusao>(
      (totais, item) => {
        const valor = Math.round((item.valor_total + Number.EPSILON) * 100) / 100;
        if (/pe[çc]a/i.test(item.categoria_financeira?.nome ?? "")) {
          totais.pecas += valor;
        } else {
          totais.servicos += valor;
        }
        return totais;
      },
      { pecas: 0, servicos: 0 }
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
    orcamento: { deleted_at: string | null } | null;
  };

  const { data: ordem, error: ordemError } = await supabase
    .from("ordem_servico")
    .select("orcamento_id")
    .eq("id", ordemId)
    .single()
    .overrideTypes<{ orcamento_id: string | null }, { merge: false }>();

  if (ordemError) throw ordemError;

  let orcamentoId = ordem.orcamento_id;
  if (!orcamentoId) {
    const { data: orcamento, error: orcamentoError } = await supabase
      .from("orcamento")
      .select("id")
      .eq("ordem_servico_id", ordemId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()
      .overrideTypes<{ id: string } | null, { merge: false }>();

    if (orcamentoError) throw orcamentoError;
    orcamentoId = orcamento?.id ?? null;
  }

  if (!orcamentoId) return [];

  const { data, error } = await supabase
    .from("orcamento_item")
    .select(
      "tipo, descricao, quantidade, preco_unitario, desconto, orcamento!inner(deleted_at), created_at"
    )
    .eq("orcamento_id", orcamentoId)
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

// Histórico completo de OS de um cliente (todos os veículos), com os itens do
// serviço e o total — alimenta a aba de histórico no perfil do cliente. Lê a
// OS + o orçamento vinculado; a escolha do orçamento e a soma ficam no domínio
// (montarHistoricoOs) para serem testáveis.
export async function buscarHistoricoDoCliente(
  supabase: Client,
  clienteId: string
): Promise<HistoricoOs[]> {
  const { data, error } = await supabase
    .from("ordem_servico")
    .select(
      "id, numero, status, data_abertura, data_conclusao, queixa, " +
        "veiculo(id, modelo, marca, placa, cor), funcionario(nome), " +
        "orcamento(status, orcamento_item(descricao, tipo, quantidade, preco_unitario, desconto, aprovado))"
    )
    .eq("cliente_id", clienteId)
    .is("deleted_at", null)
    .order("data_abertura", { ascending: false })
    .overrideTypes<Parameters<typeof montarHistoricoOs>[0], { merge: false }>();

  if (error) throw error;
  return montarHistoricoOs(data);
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
