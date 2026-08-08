import { z } from "zod";

// Tipo de item de orçamento parametrizável pela oficina. O "nome" é o rótulo
// livre mostrado no dialog; a "natureza" (peça/serviço) dita a categorização
// financeira na conclusão e o fluxo de compra — por isso é obrigatória.
export const tipoItemSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome do tipo").max(40, "Nome muito longo"),
  natureza: z.enum(["peca", "servico"], { error: "Escolha a natureza" }),
  ativo: z.boolean().optional().default(true),
});

export type TipoItemInput = z.output<typeof tipoItemSchema>;
export type TipoItemFormValues = z.input<typeof tipoItemSchema>;
