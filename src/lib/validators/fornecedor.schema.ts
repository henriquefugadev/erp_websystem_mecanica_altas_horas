import { z } from "zod";
import { validarCNPJ, validarCPF, normalizarDocumento } from "./documento";
import { normalizarTelefone, validarTelefone } from "./contato";

// Só nome é obrigatório: cadastro rápido, o resto se completa depois — mesmo
// espírito de reduzir cliques da Michele que orienta o cliente.schema.ts.
export const fornecedorSchema = z
  .object({
    nome: z.string().trim().min(1, "Nome é obrigatório"),
    documento: z.string().trim().optional().or(z.literal("")),
    telefone: z
      .string()
      .trim()
      .refine((v) => v === "" || validarTelefone(v), "Telefone inválido")
      .transform((v) => (v === "" ? undefined : normalizarTelefone(v)))
      .optional(),
    email: z.string().trim().email("E-mail inválido").optional().or(z.literal("")),
    contatoNome: z.string().trim().optional().or(z.literal("")),
    condicoesPagamento: z.string().trim().optional().or(z.literal("")),
    prazoEntregaDias: z
      .union([z.literal(""), z.coerce.number().int().positive()])
      .transform((v) => (v === "" ? undefined : v))
      .optional(),
    observacoes: z.string().trim().optional().or(z.literal("")),
    ativo: z.boolean().default(true),
  })
  .superRefine((dados, ctx) => {
    if (dados.documento && !validarCPF(dados.documento) && !validarCNPJ(dados.documento)) {
      ctx.addIssue({
        code: "custom",
        path: ["documento"],
        message: "CPF ou CNPJ inválido",
      });
    }
  })
  .transform((dados) => ({
    ...dados,
    documento: dados.documento ? normalizarDocumento(dados.documento) : "",
  }));

export type FornecedorInput = z.infer<typeof fornecedorSchema>;
