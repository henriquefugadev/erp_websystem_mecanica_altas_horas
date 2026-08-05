import { formatarPlaca } from "@/lib/format";

// Link de conversa do WhatsApp pré-preenchido. Usado em vários módulos
// (orçamento, cotação, aviso de OS pronta), por isso mora aqui e não mais
// dentro do módulo de orçamento.
export function montarLinkWhatsApp(telefone: string, texto: string): string {
  const digitos = telefone.replace(/\D/g, "");
  return `https://wa.me/55${digitos}?text=${encodeURIComponent(texto)}`;
}

export interface VeiculoResumo {
  placa: string;
  modelo: string;
  marca: string | null;
  ano: number | null;
}

// Descreve o veículo numa linha ("Marca Modelo 2018 — ABC-1D23"), para o
// cabeçalho das mensagens de cotação / aviso.
export function descreverVeiculo(veiculo: VeiculoResumo): string {
  const nome = [veiculo.marca, veiculo.modelo, veiculo.ano ?? undefined]
    .filter(Boolean)
    .join(" ");
  return `${nome} — ${formatarPlaca(veiculo.placa)}`;
}

// Mensagem para pedir cotação de peças ao fornecedor pelo WhatsApp.
export function montarTextoCotacao(
  veiculo: VeiculoResumo,
  itens: { descricao: string; quantidade: number }[]
): string {
  const linhas = itens.map((i) => `• ${i.descricao} (x${i.quantidade})`).join("\n");
  return [
    "Olá! Pode me passar o orçamento destas peças?",
    "",
    `Veículo: ${descreverVeiculo(veiculo)}`,
    "",
    linhas,
  ].join("\n");
}
