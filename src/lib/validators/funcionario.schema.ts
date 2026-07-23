import { z } from "zod";
import { normalizarTelefone, validarTelefone } from "./contato";

export const funcionarioSchema = z.object({
  nome: z.string().trim().min(1, "Nome é obrigatório"),
  funcao: z.string().trim().optional().or(z.literal("")),
  telefone: z
    .string()
    .trim()
    .refine((v) => v === "" || validarTelefone(v), "Telefone inválido")
    .transform((v) => (v === "" ? undefined : normalizarTelefone(v)))
    .optional(),
  email: z.string().trim().email("E-mail inválido").optional().or(z.literal("")),
  observacoes: z.string().trim().optional().or(z.literal("")),
  ativo: z.boolean().default(true),
});

export type FuncionarioInput = z.infer<typeof funcionarioSchema>;
