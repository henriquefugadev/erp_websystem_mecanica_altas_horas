import type { z } from "zod";
import type { fornecedorSchema } from "@/lib/validators/fornecedor.schema";

export type FornecedorFormValues = z.input<typeof fornecedorSchema>;
export type FornecedorFormOutput = z.output<typeof fornecedorSchema>;

export const fornecedorDefaultValues: FornecedorFormValues = {
  nome: "",
  documento: "",
  telefone: "",
  email: "",
  contatoNome: "",
  condicoesPagamento: "",
  prazoEntregaDias: "",
  observacoes: "",
  ativo: true,
};
