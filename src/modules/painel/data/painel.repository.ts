import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { hojeSaoPaulo } from "@/lib/format";

type Client = SupabaseClient<Database>;

// Uma linha acionável do painel: leva direto para onde a Michele resolve.
export interface LinhaPainel {
  chave: string;
  primario: string;
  secundario: string | null;
  href: string;
}

// Um bloco de pendências (só aparece quando tem algo). `total` pode ser maior
// que `linhas.length` — a lista é uma amostra (até 5).
export interface BlocoPainel {
  chave: string;
  titulo: string;
  acao: string;
  total: number;
  linhas: LinhaPainel[];
}

const AMOSTRA = 5;

function labelVeiculo(v: { placa: string; modelo: string; marca: string | null } | null): string {
  if (!v) return "—";
  const nome = [v.marca, v.modelo].filter(Boolean).join(" ");
  return `${nome} · ${v.placa}`;
}

function emDias(dias: number): string {
  return new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString();
}

function dataMaisDias(dias: number): string {
  return new Date(Date.parse(hojeSaoPaulo()) + dias * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

// 1) Veículos aguardando diagnóstico: OS em "aguardando" sem orçamento vinculado.
async function osSemDiagnostico(supabase: Client): Promise<BlocoPainel | null> {
  type Row = {
    id: string;
    numero: number;
    cliente: { nome: string } | null;
    veiculo: { placa: string; modelo: string; marca: string | null } | null;
  };
  const { data, count, error } = await supabase
    .from("ordem_servico")
    .select("id, numero, cliente(nome), veiculo(placa, modelo, marca)", { count: "exact" })
    .eq("status", "aguardando")
    .is("orcamento_id", null)
    .is("deleted_at", null)
    .order("numero")
    .limit(AMOSTRA)
    .overrideTypes<Row[], { merge: false }>();

  if (error) throw error;
  if (!count) return null;

  return {
    chave: "sem-diagnostico",
    titulo: "Aguardando diagnóstico",
    acao: "Registrar diagnóstico",
    total: count,
    linhas: data.map((o) => ({
      chave: o.id,
      primario: `OS #${o.numero} — ${labelVeiculo(o.veiculo)}`,
      secundario: o.cliente?.nome ?? null,
      href: "/patio",
    })),
  };
}

// 2 e 3) Rascunhos: os que têm peça sem cotação (→ Cotar) e os já 100%
// precificados (→ Enviar). Uma query só, dividida em dois blocos.
async function blocosRascunho(
  supabase: Client
): Promise<{ semCotacao: BlocoPainel | null; prontos: BlocoPainel | null }> {
  type Row = {
    id: string;
    numero: number;
    veiculo: { placa: string; modelo: string; marca: string | null } | null;
    orcamento_item: { tipo: string; custo_cotado: number | null; preco_unitario: number }[];
  };
  const { data, error } = await supabase
    .from("orcamento")
    .select("id, numero, veiculo(placa, modelo, marca), orcamento_item(tipo, custo_cotado, preco_unitario)")
    .eq("status", "rascunho")
    .is("deleted_at", null)
    .order("numero", { ascending: false })
    .overrideTypes<Row[], { merge: false }>();

  if (error) throw error;

  const semCotacao: Row[] = [];
  const prontos: Row[] = [];
  for (const orc of data) {
    if (orc.orcamento_item.length === 0) continue;
    const faltaCotar = orc.orcamento_item.some(
      (i) => i.tipo === "peca" && i.custo_cotado === null
    );
    const todosComPreco = orc.orcamento_item.every((i) => i.preco_unitario > 0);
    if (faltaCotar) semCotacao.push(orc);
    else if (todosComPreco) prontos.push(orc);
  }

  const bloco = (
    lista: Row[],
    chave: string,
    titulo: string,
    acao: string,
    href: (o: Row) => string
  ): BlocoPainel | null =>
    lista.length === 0
      ? null
      : {
          chave,
          titulo,
          acao,
          total: lista.length,
          linhas: lista.slice(0, AMOSTRA).map((o) => ({
            chave: o.id,
            primario: `Orçamento #${o.numero}`,
            secundario: labelVeiculo(o.veiculo),
            href: href(o),
          })),
        };

  return {
    semCotacao: bloco(semCotacao, "sem-cotacao", "Peças sem cotação", "Cotar", () => "/cotacoes"),
    prontos: bloco(
      prontos,
      "pronto-enviar",
      "Prontos para enviar",
      "Enviar",
      (o) => `/orcamentos/${o.id}`
    ),
  };
}

// 4) Sem resposta do cliente: enviados há 2 dias ou mais.
async function orcamentosSemResposta(supabase: Client): Promise<BlocoPainel | null> {
  type Row = {
    id: string;
    numero: number;
    cliente: { nome: string } | null;
    veiculo: { placa: string; modelo: string; marca: string | null } | null;
  };
  const { data, count, error } = await supabase
    .from("orcamento")
    .select("id, numero, cliente(nome), veiculo(placa, modelo, marca)", { count: "exact" })
    .eq("status", "enviado")
    .lte("enviado_em", emDias(-2))
    .is("deleted_at", null)
    .order("enviado_em")
    .limit(AMOSTRA)
    .overrideTypes<Row[], { merge: false }>();

  if (error) throw error;
  if (!count) return null;

  return {
    chave: "sem-resposta",
    titulo: "Sem resposta do cliente",
    acao: "Cobrar no WhatsApp",
    total: count,
    linhas: data.map((o) => ({
      chave: o.id,
      primario: `Orçamento #${o.numero} — ${labelVeiculo(o.veiculo)}`,
      secundario: o.cliente?.nome ?? null,
      href: `/orcamentos/${o.id}`,
    })),
  };
}

// 5) Aprovados sem compra: itens de peça aprovados que ainda não viraram pedido.
async function aprovadosSemCompra(supabase: Client): Promise<BlocoPainel | null> {
  type Row = {
    id: string;
    orcamento: {
      id: string;
      numero: number;
      veiculo: { placa: string; modelo: string; marca: string | null } | null;
    } | null;
  };
  const { data, error } = await supabase
    .from("orcamento_item")
    .select("id, orcamento!inner(id, numero, status, deleted_at, veiculo(placa, modelo, marca))")
    .eq("tipo", "peca")
    .eq("aprovado", true)
    .in("orcamento.status", ["aprovado", "aprovado_parcial"])
    .is("orcamento.deleted_at", null)
    .overrideTypes<Row[], { merge: false }>();

  if (error) throw error;
  if (data.length === 0) return null;

  const ids = data.map((i) => i.id);
  const { data: comprados, error: erroCompra } = await supabase
    .from("pedido_compra_item")
    .select("orcamento_item_id")
    .in("orcamento_item_id", ids);
  if (erroCompra) throw erroCompra;
  const jaComprado = new Set((comprados ?? []).map((c) => c.orcamento_item_id));

  // Um orçamento por linha (dedupe pelos itens ainda não comprados).
  const porOrcamento = new Map<string, Row["orcamento"]>();
  for (const item of data) {
    if (jaComprado.has(item.id)) continue;
    if (item.orcamento) porOrcamento.set(item.orcamento.id, item.orcamento);
  }
  if (porOrcamento.size === 0) return null;

  const orcs = [...porOrcamento.values()];
  return {
    chave: "aprovado-sem-compra",
    titulo: "Aprovados a comprar",
    acao: "Gerar pedidos",
    total: orcs.length,
    linhas: orcs.slice(0, AMOSTRA).map((o) => ({
      chave: o!.id,
      primario: `Orçamento #${o!.numero}`,
      secundario: labelVeiculo(o!.veiculo),
      href: `/orcamentos/${o!.id}`,
    })),
  };
}

// 6) Pedidos atrasados: previsão de entrega vencida e ainda não recebidos.
async function pedidosAtrasados(supabase: Client): Promise<BlocoPainel | null> {
  type Row = { id: string; numero: number; previsao_entrega: string | null; fornecedor: { nome: string } | null };
  const { data, count, error } = await supabase
    .from("pedido_compra")
    .select("id, numero, previsao_entrega, fornecedor(nome)", { count: "exact" })
    .in("status", ["aberto", "parcial"])
    .lt("previsao_entrega", hojeSaoPaulo())
    .is("deleted_at", null)
    .order("previsao_entrega")
    .limit(AMOSTRA)
    .overrideTypes<Row[], { merge: false }>();

  if (error) throw error;
  if (!count) return null;

  return {
    chave: "pedido-atrasado",
    titulo: "Pedidos atrasados",
    acao: "Cobrar fornecedor",
    total: count,
    linhas: data.map((p) => ({
      chave: p.id,
      primario: `Pedido #${p.numero}`,
      secundario: p.fornecedor?.nome ?? null,
      href: `/compras/${p.id}`,
    })),
  };
}

// 7) Prontos, cliente não avisado: OS concluída sem cliente_avisado_em.
async function prontosNaoAvisados(supabase: Client): Promise<BlocoPainel | null> {
  type Row = {
    id: string;
    numero: number;
    cliente: { nome: string } | null;
    veiculo: { placa: string; modelo: string; marca: string | null } | null;
  };
  const { data, count, error } = await supabase
    .from("ordem_servico")
    .select("id, numero, cliente(nome), veiculo(placa, modelo, marca)", { count: "exact" })
    .eq("status", "concluido")
    .is("cliente_avisado_em", null)
    .is("deleted_at", null)
    .order("data_conclusao", { ascending: true })
    .limit(AMOSTRA)
    .overrideTypes<Row[], { merge: false }>();

  if (error) throw error;
  if (!count) return null;

  return {
    chave: "nao-avisado",
    titulo: "Prontos — avisar cliente",
    acao: "Avisar",
    total: count,
    linhas: data.map((o) => ({
      chave: o.id,
      primario: `OS #${o.numero} — ${labelVeiculo(o.veiculo)}`,
      secundario: o.cliente?.nome ?? null,
      href: "/patio",
    })),
  };
}

// 8) Financeiro: parcelas em aberto vencidas ou vencendo nos próximos 3 dias.
async function financeiroVencendo(supabase: Client): Promise<BlocoPainel | null> {
  type Row = {
    conta_id: string;
    vencimento: string;
    conta_financeira: { descricao: string; cliente: { nome: string } | null } | null;
  };
  const { data, count, error } = await supabase
    .from("parcela_financeira")
    .select("conta_id, vencimento, conta_financeira!inner(descricao, deleted_at, cliente(nome))", {
      count: "exact",
    })
    .in("status", ["aberta", "parcial"])
    .lte("vencimento", dataMaisDias(3))
    .is("conta_financeira.deleted_at", null)
    .order("vencimento")
    .limit(AMOSTRA)
    .overrideTypes<Row[], { merge: false }>();

  if (error) throw error;
  if (!count) return null;

  return {
    chave: "financeiro",
    titulo: "Contas vencendo",
    acao: "Ver contas",
    total: count,
    linhas: data.map((p) => ({
      chave: p.conta_id,
      primario: p.conta_financeira?.descricao ?? "Conta",
      secundario: p.conta_financeira?.cliente?.nome ?? null,
      href: `/financeiro/contas/${p.conta_id}`,
    })),
  };
}

// Monta o painel inteiro em paralelo, já sem os blocos vazios.
export async function carregarPainel(supabase: Client): Promise<BlocoPainel[]> {
  const [semDiagnostico, rascunhos, semResposta, semCompra, atrasados, naoAvisados, financeiro] =
    await Promise.all([
      osSemDiagnostico(supabase),
      blocosRascunho(supabase),
      orcamentosSemResposta(supabase),
      aprovadosSemCompra(supabase),
      pedidosAtrasados(supabase),
      prontosNaoAvisados(supabase),
      financeiroVencendo(supabase),
    ]);

  return [
    semDiagnostico,
    rascunhos.semCotacao,
    rascunhos.prontos,
    semResposta,
    semCompra,
    atrasados,
    naoAvisados,
    financeiro,
  ].filter((b): b is BlocoPainel => b !== null);
}
