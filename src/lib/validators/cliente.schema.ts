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
    logradouro: z.string().trim().min(1, "Endereço é obrigatório"),
    numero: z.string().trim().min(1, "Número é obrigatório"),
    complemento: z.string().trim().optional().or(z.literal("")),
    bairro: z.string().trim().optional().or(z.literal("")),
    cidade: z.string().trim().optional().or(z.literal("")),
    estado: z
      .string()
      .trim()
      .refine((v) => v === "" || v.length === 2, "UF deve ter 2 letras")
      .transform((v) => (v === "" ? undefined : v.toUpperCase()))
      .optional(),
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

// Cadastro relâmpago da recepção (tela de entrada de veículo): só nome e
// telefone são obrigatórios. Documento e endereço ficam para depois — a
// Michele completa quando (e se) precisar emitir nota. `documento` só é
// validado quando de fato preenchido.
export const clienteRapidoSchema = z
  .object({
    tipo: z.enum(["PF", "PJ"]).default("PF"),
    nome: z.string().trim().min(1, "Nome é obrigatório"),
    telefone: z
      .string()
      .trim()
      .min(1, "Telefone é obrigatório")
      .refine(validarTelefone, "Telefone inválido")
      .transform(normalizarTelefone),
    documento: z.string().trim().optional().or(z.literal("")),
  })
  .superRefine((dados, ctx) => {
    if (dados.documento && !validarDocumento(dados.tipo, dados.documento)) {
      ctx.addIssue({
        code: "custom",
        path: ["documento"],
        message: dados.tipo === "PF" ? "CPF inválido" : "CNPJ inválido",
      });
    }
  })
  .transform((dados) => ({
    ...dados,
    documento: dados.documento ? normalizarDocumento(dados.documento) : undefined,
  }));

export type ClienteRapidoInput = z.input<typeof clienteRapidoSchema>;
export type ClienteRapidoOutput = z.output<typeof clienteRapidoSchema>;
