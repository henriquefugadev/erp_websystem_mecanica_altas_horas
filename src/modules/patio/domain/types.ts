import type { Database, StatusOS, MotivoParada } from "@/lib/supabase/database.types";

export type OrdemServico = Database["public"]["Tables"]["ordem_servico"]["Row"];
export type { StatusOS, MotivoParada };

export const MOTIVO_PARADA_LABEL: Record<MotivoParada, string> = {
  aguardando_peca: "Aguardando peça",
  aguardando_aprovacao: "Aguardando aprovação",
  aguardando_cliente: "Aguardando cliente",
  outro: "Parado",
};

// Galpão é só o número da baia (1..n). A quantidade e a capacidade passaram a
// ser configuráveis (workshop.galpoes_quantidade / galpao_capacidade), então o
// tipo não pode mais ser a união fechada 1|2|3 — quem valida a faixa é
// `parametrosPatio`. GALPOES/CAPACIDADE_GALPAO continuam aqui como o padrão
// histórico usado quando não há configuração carregada.
export type Galpao = number;
export const GALPOES: Galpao[] = [1, 2, 3];
export const CAPACIDADE_GALPAO = 10;

export const STATUS_OS_LABEL: Record<StatusOS, string> = {
  aguardando: "Aguardando",
  aguardando_confirmacao: "Esperando Confirmação do Cliente",
  em_execucao: "Em Execução",
  parado: "Parado",
  concluido: "Concluído",
  cancelada: "Cancelada",
};

export type OrdemComRelacoes = OrdemServico & {
  cliente: { nome: string; telefone: string } | null;
  veiculo: { placa: string; modelo: string; marca: string | null; cor: string | null } | null;
  // conta_financeira → ordem_servico agora é 1:N (itens da conclusão), então
  // o embed do PostgREST vem como array, não mais objeto único.
  conta_financeira: { status: string }[];
  funcionario: { nome: string } | null;
};
