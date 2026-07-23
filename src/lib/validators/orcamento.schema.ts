import { z } from "zod";

export const itemOrcamentoSchema = z.object({
  tipo: z.enum(["peca", "servico"]),
  descricao: z.string().trim().min(1, "Descreva o item"),
  quantidade: z
    .union([z.literal(""), z.coerce.number({ error: "Quantidade inválida" })])
    .refine((v): v is number => v !== "" && v > 0, "Quantidade deve ser maior que zero"),
  precoUnitario: z
    .union([z.literal(""), z.coerce.number({ error: "Preço inválido" })])
    .refine((v): v is number => v !== "" && v >= 0, "Preço não pode ser negativo")
    .transform((v) => Math.round((v + Number.EPSILON) * 100) / 100),
  desconto: z
    .union([z.literal(""), z.coerce.number({ error: "Desconto inválido" })])
    .optional()
    .transform((v) => (v === "" || v === undefined ? 0 : Math.round((v + Number.EPSILON) * 100) / 100)),
});

export const orcamentoSchema = z.object({
  clienteId: z.string().trim().min(1, "Cliente é obrigatório"),
  veiculoId: z.string().trim().min(1, "Veículo é obrigatório"),
  queixa: z.string().trim().min(1, "Descreva a queixa do cliente"),
  observacoes: z.string().trim().optional().or(z.literal("")),
  condicoesPagamento: z.string().trim().optional().or(z.literal("")),
  validade: z.string().trim().min(1, "Informe a validade"),
  itens: z.array(itemOrcamentoSchema).min(1, "Adicione ao menos um item"),
});

export type OrcamentoInput = z.input<typeof orcamentoSchema>;
export type OrcamentoOutput = z.output<typeof orcamentoSchema>;
export type ItemOrcamentoOutput = z.output<typeof itemOrcamentoSchema>;
