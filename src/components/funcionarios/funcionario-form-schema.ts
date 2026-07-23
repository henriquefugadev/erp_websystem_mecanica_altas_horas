import type { z } from "zod";
import type { funcionarioSchema } from "@/lib/validators/funcionario.schema";

export type FuncionarioFormValues = z.input<typeof funcionarioSchema>;
export type FuncionarioFormOutput = z.output<typeof funcionarioSchema>;

export function funcionarioDefaultValues(): FuncionarioFormValues {
  return { nome: "", funcao: "", telefone: "", email: "", observacoes: "", ativo: true };
}
