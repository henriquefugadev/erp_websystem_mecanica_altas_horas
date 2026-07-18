import { z } from "zod";
import {
  normalizarChassi,
  normalizarPlaca,
  normalizarRenavam,
  validarChassi,
  validarPlaca,
  validarRenavam,
} from "./veiculo";

const anoAtual = new Date().getFullYear();

export const veiculoSchema = z.object({
  placa: z
    .string()
    .trim()
    .refine(validarPlaca, "Placa inválida")
    .transform(normalizarPlaca),
  marca: z.string().trim().optional().or(z.literal("")),
  modelo: z.string().trim().min(1, "Modelo é obrigatório"),
  versao: z.string().trim().optional().or(z.literal("")),
  ano: z
    .union([z.literal(""), z.coerce.number().int().min(1900).max(anoAtual + 1)])
    .transform((v) => (v === "" ? undefined : v))
    .optional(),
  combustivel: z.string().trim().optional().or(z.literal("")),
  cor: z.string().trim().optional().or(z.literal("")),
  chassi: z
    .string()
    .trim()
    .refine((v) => v === "" || validarChassi(v), "Chassi inválido")
    .transform((v) => (v === "" ? undefined : normalizarChassi(v)))
    .optional(),
  renavam: z
    .string()
    .trim()
    .refine((v) => v === "" || validarRenavam(v), "Renavam inválido")
    .transform((v) => (v === "" ? undefined : normalizarRenavam(v)))
    .optional(),
  quilometragem: z
    .union([z.literal(""), z.coerce.number().int().min(0)])
    .transform((v) => (v === "" ? undefined : v))
    .optional(),
  notas: z.string().trim().optional().or(z.literal("")),
});

export type VeiculoInput = z.infer<typeof veiculoSchema>;
