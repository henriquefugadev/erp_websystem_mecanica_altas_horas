import type { z } from "zod";
import type { pagamentoSchema } from "@/lib/validators/financeiro.schema";
import { hojeSaoPaulo } from "@/lib/format";

export type PagamentoFormValues = z.input<typeof pagamentoSchema>;
export type PagamentoFormOutput = z.output<typeof pagamentoSchema>;

export function pagamentoDefaultValues(valorSugerido: number): PagamentoFormValues {
  return {
    valor: valorSugerido,
    desconto: "",
    dataPagamento: hojeSaoPaulo(),
    formaPagamento: "dinheiro",
    observacoes: "",
  };
}
