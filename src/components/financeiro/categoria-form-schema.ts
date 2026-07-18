import type { z } from "zod";
import type { categoriaSchema } from "@/lib/validators/financeiro.schema";

export type CategoriaFormValues = z.input<typeof categoriaSchema>;
export type CategoriaFormOutput = z.output<typeof categoriaSchema>;

export function categoriaDefaultValues(
  tipoInicial: "receita" | "despesa" = "receita"
): CategoriaFormValues {
  return { tipo: tipoInicial, nome: "" };
}
