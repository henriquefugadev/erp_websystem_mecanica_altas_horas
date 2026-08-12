import type { StatusOS } from "@/lib/supabase/database.types";
import { calcularSubtotalItem } from "@/modules/orcamento/domain/calculo";

/**
 * Monta o histórico de uma OS (o que foi feito no carro) a partir das linhas
 * cruas do banco. Isolado aqui para ser testável puramente: a escolha de qual
 * orçamento representa a OS e a soma dos itens não dependem do Supabase.
 */

export interface HistoricoItem {
  descricao: string;
  tipo: "peca" | "servico";
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
}

export interface HistoricoOs {
  id: string;
  numero: number;
  titulo: string | null;
  status: StatusOS;
  dataAbertura: string;
  dataConclusao: string | null;
  garantiaAte: string | null;
  queixa: string | null;
  funcionario: string | null;
  veiculo: { id: string; nome: string; placa: string; cor: string | null } | null;
  itens: HistoricoItem[];
  total: number;
  // Se os itens vêm de um orçamento aprovado pelo cliente (serviço realizado) ou
  // ainda são um rascunho/proposta (orçamento não aprovado).
  aprovado: boolean;
}

interface OrcamentoItemRaw {
  descricao: string;
  tipo: "peca" | "servico";
  quantidade: number;
  preco_unitario: number;
  desconto: number;
  aprovado: boolean | null;
}

interface OrcamentoRaw {
  status: string;
  orcamento_item: OrcamentoItemRaw[];
}

export interface OrdemHistoricoRaw {
  id: string;
  numero: number;
  titulo: string | null;
  status: StatusOS;
  data_abertura: string;
  data_conclusao: string | null;
  garantia_ate: string | null;
  queixa: string | null;
  veiculo: {
    id: string;
    modelo: string;
    marca: string | null;
    placa: string;
    cor: string | null;
  } | null;
  funcionario: { nome: string } | null;
  orcamento: OrcamentoRaw[];
}

const STATUS_APROVADO = ["aprovado", "aprovado_parcial"];

function mapItem(item: OrcamentoItemRaw): HistoricoItem {
  return {
    descricao: item.descricao,
    tipo: item.tipo,
    quantidade: item.quantidade,
    precoUnitario: item.preco_unitario,
    subtotal: calcularSubtotalItem({
      quantidade: item.quantidade,
      precoUnitario: item.preco_unitario,
      desconto: item.desconto,
    }),
  };
}

export function montarHistoricoOs(ordens: OrdemHistoricoRaw[]): HistoricoOs[] {
  return ordens.map((ordem) => {
    // Prefere o orçamento aprovado (o que virou serviço); só os itens aprovados.
    const aprovado = (ordem.orcamento ?? []).find((o) => STATUS_APROVADO.includes(o.status));
    let itensRaw: OrcamentoItemRaw[];
    let foiAprovado: boolean;

    if (aprovado) {
      itensRaw = aprovado.orcamento_item.filter((i) => i.aprovado === true);
      foiAprovado = true;
    } else {
      // Sem aprovação: mostra a proposta (primeiro orçamento existente, todos os itens).
      itensRaw = (ordem.orcamento ?? [])[0]?.orcamento_item ?? [];
      foiAprovado = false;
    }

    const itens = itensRaw.map(mapItem);
    const total = Math.round(itens.reduce((s, i) => s + i.subtotal, 0) * 100) / 100;

    return {
      id: ordem.id,
      numero: ordem.numero,
      titulo: ordem.titulo,
      status: ordem.status,
      dataAbertura: ordem.data_abertura,
      dataConclusao: ordem.data_conclusao,
      garantiaAte: ordem.garantia_ate,
      queixa: ordem.queixa,
      funcionario: ordem.funcionario?.nome ?? null,
      veiculo: ordem.veiculo
        ? {
            id: ordem.veiculo.id,
            nome: [ordem.veiculo.marca, ordem.veiculo.modelo].filter(Boolean).join(" ") || "—",
            placa: ordem.veiculo.placa,
            cor: ordem.veiculo.cor,
          }
        : null,
      itens,
      total,
      aprovado: foiAprovado,
    };
  });
}
