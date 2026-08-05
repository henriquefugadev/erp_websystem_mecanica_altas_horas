import { z } from "zod";

// Uma linha de cotação vinda da tela: fornecedor escolhido e custo digitado.
// custoCotado vazio = ainda não cotado (fica null).
export const cotacaoItemSchema = z.object({
  id: z.string().uuid(),
  fornecedorId: z.string().trim().optional().or(z.literal("")),
  custoCotado: z
    .union([z.literal(""), z.coerce.number({ error: "Custo inválido" }).min(0, "Custo inválido")])
    .transform((v) => (v === "" ? null : v)),
});

export const cotacoesSchema = z.object({
  itens: z.array(cotacaoItemSchema),
});

export type CotacoesInput = z.input<typeof cotacoesSchema>;
export type CotacoesOutput = z.output<typeof cotacoesSchema>;
