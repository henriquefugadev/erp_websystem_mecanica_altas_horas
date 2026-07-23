import { z } from "zod";
import { normalizarPlaca, validarPlaca } from "./veiculo";

const anoAtual = new Date().getFullYear();

export const veiculoSchema = z.object({
  placa: z
    .string()
    .trim()
    .refine(validarPlaca, "Placa inválida")
    .transform(normalizarPlaca),
  marca: z.string().trim().optional().or(z.literal("")),
  modelo: z.string().trim().min(1, "Modelo é obrigatório"),
  ano: z
    .union([z.literal(""), z.coerce.number().int().min(1900).max(anoAtual + 1)])
    .transform((v) => (v === "" ? undefined : v))
    .optional(),
  cor: z.string().trim().optional().or(z.literal("")),
  quilometragem: z
    .union([z.literal(""), z.coerce.number().int().min(0)])
    .transform((v) => (v === "" ? undefined : v))
    .optional(),
  notas: z.string().trim().optional().or(z.literal("")),
});

export type VeiculoInput = z.infer<typeof veiculoSchema>;
