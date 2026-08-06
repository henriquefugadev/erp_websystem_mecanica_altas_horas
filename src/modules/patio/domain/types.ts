import type { Database, StatusOS, MotivoParada } from "@/lib/supabase/database.types";

export type OrdemServico = Database["public"]["Tables"]["ordem_servico"]["Row"];
export type { StatusOS, MotivoParada };

export const MOTIVO_PARADA_LABEL: Record<MotivoParada, string> = {
  aguardando_peca: "Aguardando peça",
  aguardando_aprovacao: "Aguardando aprovação",
  aguardando_cliente: "Aguardando cliente",
  outro: "Parado",
};

export const GALPOES = [1, 2, 3] as const;
export type Galpao = (typeof GALPOES)[number];
export const CAPACIDADE_GALPAO = 10;

export const STATUS_OS_LABEL: Record<StatusOS, string> = {
  aguardando: "Aguardando",
  em_execucao: "Em Execução",
  parado: "Parado",
  concluido: "Concluído",
  cancelada: "Cancelada",
};

export type OrdemComRelacoes = OrdemServico & {
  cliente: { nome: string; telefone: string } | null;
  veiculo: { placa: string; modelo: string; marca: string | null } | null;
  // conta_financeira → ordem_servico agora é 1:N (itens da conclusão), então
  // o embed do PostgREST vem como array, não mais objeto único.
  conta_financeira: { status: string }[];
  funcionario: { nome: string } | null;
};
