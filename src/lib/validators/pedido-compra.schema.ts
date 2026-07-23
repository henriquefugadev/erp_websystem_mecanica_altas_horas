import { z } from "zod";

// Arredonda pro mesmo número de casas da coluna do banco, mesmo raciocínio
// de valorMonetarioSchema em financeiro.schema.ts — o valor que chega ao
// formulário precisa bater com o que foi persistido.
const quantidadeSchema = z
  .union([z.literal(""), z.coerce.number({ error: "Quantidade inválida" })])
  .refine((v): v is number => v !== "" && v > 0, "Quantidade deve ser maior que zero")
  .transform((v) => Math.round((v + Number.EPSILON) * 1000) / 1000);

const precoUnitarioSchema = z
  .union([z.literal(""), z.coerce.number({ error: "Preço inválido" })])
  .refine((v): v is number => v !== "" && v > 0, "Preço deve ser maior que zero")
  .transform((v) => Math.round((v + Number.EPSILON) * 100) / 100);

export const itemPedidoCompraSchema = z.object({
  descricao: z.string().trim().min(1, "Descreva o item"),
  quantidade: quantidadeSchema,
  precoUnitario: precoUnitarioSchema,
});

export type ItemPedidoCompraInput = z.infer<typeof itemPedidoCompraSchema>;

export const pedidoCompraSchema = z.object({
  fornecedorId: z.string().trim().min(1, "Fornecedor é obrigatório"),
  categoriaId: z.string().trim().min(1, "Categoria é obrigatória"),
  dataEmissao: z.string().min(1, "Data de emissão é obrigatória"),
  previsaoEntrega: z.string().trim().optional().or(z.literal("")),
  ordemServicoId: z.string().trim().optional().or(z.literal("")),
  observacoes: z.string().trim().optional().or(z.literal("")),
  itens: z.array(itemPedidoCompraSchema).min(1, "Inclua ao menos um item"),
});

export type PedidoCompraInput = z.infer<typeof pedidoCompraSchema>;

export const itemRecebimentoSchema = z.object({
  pedidoItemId: z.string().trim().min(1),
  quantidade: quantidadeSchema,
});

export type ItemRecebimentoInput = z.infer<typeof itemRecebimentoSchema>;

export const recebimentoSchema = z.object({
  dataRecebimento: z.string().min(1, "Data de recebimento é obrigatória"),
  vencimento: z.string().min(1, "Informe o vencimento da conta a pagar"),
  observacoes: z.string().trim().optional().or(z.literal("")),
  itens: z.array(itemRecebimentoSchema).min(1, "Informe ao menos um item recebido"),
});

export type RecebimentoInput = z.infer<typeof recebimentoSchema>;
