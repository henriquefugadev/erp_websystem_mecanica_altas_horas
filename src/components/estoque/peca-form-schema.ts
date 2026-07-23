import type { z } from "zod";
import type { pecaSchema } from "@/lib/validators/peca.schema";

export type PecaFormValues = z.input<typeof pecaSchema>;
export type PecaFormOutput = z.output<typeof pecaSchema>;

export const pecaDefaultValues: PecaFormValues = {
  sku: "",
  nome: "",
  fabricante: "",
  aplicacao: "",
  unidade: "UN",
  localizacao: "",
  precoVenda: "",
  estoqueMinimo: "",
  observacoes: "",
  ativo: true,
  quantidadeInicial: "",
  custoInicial: "",
};
