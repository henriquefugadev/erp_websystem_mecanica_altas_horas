import { z } from "zod";

// Diagnóstico do mecânico = rascunho do orçamento (Fase 2). O mecânico só
// preenche o que enxerga na oficina: tipo, descrição e quantidade — sem preço,
// que ele não sabe (isso entra na fase de cotação).
//
// preço/desconto/custo/fornecedor viajam junto SOMENTE para itens que já
// existiam, para que reeditar o diagnóstico não apague uma cotação já feita.
// Itens novos nascem sem esses campos.
export const itemDiagnosticoSchema = z.object({
  tipo: z.enum(["peca", "servico"]),
  descricao: z.string().trim().min(1, "Descreva o item"),
  quantidade: z
    .union([z.literal(""), z.coerce.number({ error: "Quantidade inválida" })])
    .refine((v): v is number => v !== "" && v > 0, "Quantidade deve ser maior que zero"),
  pecaId: z.string().trim().optional().or(z.literal("")),
  fornecedorId: z.string().trim().optional().or(z.literal("")),
  precoUnitario: z.number().optional(),
  desconto: z.number().optional(),
  custoCotado: z.number().nullish(),
});

export const diagnosticoSchema = z.object({
  itens: z.array(itemDiagnosticoSchema).min(1, "Adicione ao menos um item"),
});

export type DiagnosticoInput = z.input<typeof diagnosticoSchema>;
export type DiagnosticoOutput = z.output<typeof diagnosticoSchema>;
export type ItemDiagnosticoInput = z.input<typeof itemDiagnosticoSchema>;
