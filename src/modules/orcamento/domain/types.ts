import type { Database, StatusOrcamentoEfetivo } from "@/lib/supabase/database.types";

export type Orcamento = Database["public"]["Tables"]["orcamento"]["Row"];
export type OrcamentoItem = Database["public"]["Tables"]["orcamento_item"]["Row"];
export type VwOrcamento = Database["public"]["Views"]["vw_orcamento"]["Row"];
export type { StatusOrcamentoEfetivo };

export const STATUS_ORCAMENTO_LABEL: Record<StatusOrcamentoEfetivo, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  aprovado: "Aprovado",
  aprovado_parcial: "Aprovado parcialmente",
  recusado: "Recusado",
  cancelado: "Cancelado",
  expirado: "Expirado",
};

export type OrcamentoComRelacoes = VwOrcamento & {
  cliente: { nome: string; telefone: string } | null;
  veiculo: {
    placa: string;
    modelo: string;
    marca: string | null;
    ano: number | null;
    cor: string | null;
    quilometragem: number | null;
  } | null;
  orcamento_item: OrcamentoItem[];
  ordem_servico: { numero: number; funcionario: { nome: string } | null } | null;
};

export type OrcamentoComCliente = VwOrcamento & {
  cliente: { nome: string } | null;
  veiculo: { placa: string; modelo: string; marca: string | null } | null;
};
