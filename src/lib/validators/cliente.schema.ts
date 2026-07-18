import { z } from "zod";
import { validarCEP, normalizarCEP } from "./contato";
import { validarDocumento, normalizarDocumento } from "./documento";
import { validarTelefone, normalizarTelefone } from "./contato";

export const clienteSchema = z
  .object({
    tipo: z.enum(["PF", "PJ"]),
    nome: z.string().trim().min(1, "Nome é obrigatório"),
    documento: z.string().trim().min(1, "Documento é obrigatório"),
    telefone: z
      .string()
      .trim()
      .min(1, "Telefone é obrigatório")
      .refine(validarTelefone, "Telefone inválido")
      .transform(normalizarTelefone),
    email: z
      .string()
      .trim()
      .email("E-mail inválido")
      .optional()
      .or(z.literal("")),
    cep: z
      .string()
      .trim()
      .refine(validarCEP, "CEP inválido")
      .transform(normalizarCEP),
    logradouro: z.string().trim().min(1, "Logradouro é obrigatório"),
    numero: z.string().trim().min(1, "Número é obrigatório"),
    complemento: z.string().trim().optional().or(z.literal("")),
    bairro: z.string().trim().min(1, "Bairro é obrigatório"),
    cidade: z.string().trim().min(1, "Cidade é obrigatória"),
    estado: z
      .string()
      .trim()
      .length(2, "UF deve ter 2 letras")
      .transform((v) => v.toUpperCase()),
    origem: z.string().trim().optional().or(z.literal("")),
    notas: z.string().trim().optional().or(z.literal("")),
    consenteEmail: z.boolean().default(false),
    consenteSms: z.boolean().default(false),
  })
  .superRefine((dados, ctx) => {
    if (!validarDocumento(dados.tipo, dados.documento)) {
      ctx.addIssue({
        code: "custom",
        path: ["documento"],
        message: dados.tipo === "PF" ? "CPF inválido" : "CNPJ inválido",
      });
    }
  })
  .transform((dados) => ({
    ...dados,
    documento: normalizarDocumento(dados.documento),
  }));

export type ClienteInput = z.infer<typeof clienteSchema>;
