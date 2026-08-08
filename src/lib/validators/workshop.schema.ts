import { z } from "zod";
import { validarCEP, normalizarCEP, validarTelefone, normalizarTelefone } from "./contato";
import { validarCNPJ, normalizarDocumento } from "./documento";

export const workshopSchema = z.object({
  nome: z.string().trim().min(1, "Nome é obrigatório"),
  razaoSocial: z.string().trim().optional().or(z.literal("")),
  cnpj: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || validarCNPJ(v), "CNPJ inválido")
    .transform((v) => (v ? normalizarDocumento(v) : "")),
  telefone: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || validarTelefone(v), "Telefone inválido")
    .transform((v) => (v ? normalizarTelefone(v) : "")),
  email: z.string().trim().email("E-mail inválido").optional().or(z.literal("")),
  cep: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || validarCEP(v), "CEP inválido")
    .transform((v) => (v ? normalizarCEP(v) : "")),
  logradouro: z.string().trim().optional().or(z.literal("")),
  numero: z.string().trim().optional().or(z.literal("")),
  complemento: z.string().trim().optional().or(z.literal("")),
  bairro: z.string().trim().optional().or(z.literal("")),
  cidade: z.string().trim().optional().or(z.literal("")),
  estado: z
    .string()
    .trim()
    .refine((v) => v === "" || v.length === 2, "UF deve ter 2 letras")
    .transform((v) => (v === "" ? "" : v.toUpperCase()))
    .optional()
    .or(z.literal("")),
  condicoesPagamentoPadrao: z.string().trim().optional().or(z.literal("")),
  validadeOrcamentoDias: z.coerce.number().int().min(1, "Mínimo 1 dia"),
  markupPecaPercentual: z.coerce.number().min(0, "Não pode ser negativo"),
  valorHoraMaoObra: z.coerce.number().min(0, "Não pode ser negativo"),
  // Liga/desliga do botão "Aplicar markup" no orçamento — o código fica, só
  // some da tela quando desligado.
  markupHabilitado: z.boolean().optional().default(false),
  // Hrefs de itens da sidebar que ficam escondidos (sem apagar rota/código).
  navOcultos: z.array(z.string()).optional().default([]),
});

// workshopSchema termina com .transform() em vários campos; o formulário
// trabalha com o formato de entrada (pré-transform) e o resolver produz o
// formato de saída — mesmo padrão de cliente-form-schema.ts.
export type WorkshopFormValues = z.input<typeof workshopSchema>;
export type WorkshopInput = z.output<typeof workshopSchema>;
