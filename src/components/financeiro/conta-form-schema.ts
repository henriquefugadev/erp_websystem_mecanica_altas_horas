import type { z } from "zod";
import type { contaSchema } from "@/lib/validators/financeiro.schema";
import { hojeSaoPaulo } from "@/lib/format";

export type ContaFormValues = z.input<typeof contaSchema>;
export type ContaFormOutput = z.output<typeof contaSchema>;

export function contaDefaultValues(
  tipoInicial: "receber" | "pagar" = "receber"
): ContaFormValues {
  return {
    tipo: tipoInicial,
    descricao: "",
    categoriaId: "",
    clienteId: "",
    fornecedorNome: "",
    valorTotal: "",
    dataEmissao: hojeSaoPaulo(),
    observacoes: "",
    parcelas: [],
  };
}
