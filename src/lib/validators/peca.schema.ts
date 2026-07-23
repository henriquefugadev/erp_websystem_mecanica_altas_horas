import { z } from "zod";

// Mesmo raciocínio de quantidadeSchema/precoUnitarioSchema em
// pedido-compra.schema.ts: arredonda pro mesmo número de casas da coluna do
// banco, pra o valor exibido no formulário bater com o que foi persistido.
const quantidadeSchema = z
  .union([z.literal(""), z.coerce.number({ error: "Quantidade inválida" })])
  .refine((v): v is number => v !== "" && v > 0, "Quantidade deve ser maior que zero")
  .transform((v) => Math.round((v + Number.EPSILON) * 1000) / 1000);

const quantidadeOpcionalSchema = z
  .union([z.literal(""), z.coerce.number({ error: "Quantidade inválida" })])
  .transform((v) => (v === "" ? undefined : Math.round((v + Number.EPSILON) * 1000) / 1000))
  .optional();

const valorMonetarioOpcionalSchema = z
  .union([z.literal(""), z.coerce.number({ error: "Valor inválido" })])
  .transform((v) => (v === "" ? undefined : Math.round((v + Number.EPSILON) * 100) / 100))
  .optional();

// Só nome é obrigatório — mesmo espírito de reduzir cliques da Michele que
// orienta cliente/fornecedor.schema.ts. custo_medio não é campo do
// formulário: é derivado do ledger (trigger app.aplicar_movimento_estoque),
// só se altera registrando uma entrada.
export const pecaSchema = z
  .object({
    sku: z.string().trim().optional().or(z.literal("")),
    nome: z.string().trim().min(1, "Nome é obrigatório"),
    fabricante: z.string().trim().optional().or(z.literal("")),
    aplicacao: z.string().trim().optional().or(z.literal("")),
    unidade: z.string().trim().min(1, "Unidade é obrigatória").default("UN"),
    localizacao: z.string().trim().optional().or(z.literal("")),
    precoVenda: valorMonetarioOpcionalSchema.transform((v) => v ?? 0),
    estoqueMinimo: quantidadeOpcionalSchema.transform((v) => v ?? 0),
    observacoes: z.string().trim().optional().or(z.literal("")),
    ativo: z.boolean().default(true),
    // Estoque de abertura, opcional: se informado, vira a primeira entrada
    // da peça — mesma regra de "nunca editar estoque_atual direto".
    quantidadeInicial: quantidadeOpcionalSchema,
    custoInicial: valorMonetarioOpcionalSchema,
  })
  .transform((dados) => ({
    ...dados,
    sku: dados.sku || "",
  }));

export type PecaInput = z.infer<typeof pecaSchema>;

const TIPOS_MOVIMENTACAO_MANUAL = ["entrada", "devolucao", "perda"] as const;

export const movimentacaoSchema = z.object({
  pecaId: z.string().trim().min(1, "Peça é obrigatória"),
  tipo: z.enum(TIPOS_MOVIMENTACAO_MANUAL),
  quantidade: quantidadeSchema,
  custoUnitario: valorMonetarioOpcionalSchema,
  observacao: z.string().trim().optional().or(z.literal("")),
});

export type MovimentacaoInput = z.infer<typeof movimentacaoSchema>;

export const ajusteSchema = z.object({
  pecaId: z.string().trim().min(1, "Peça é obrigatória"),
  quantidadeContada: z
    .union([z.literal(""), z.coerce.number({ error: "Quantidade inválida" })])
    .refine((v): v is number => v !== "" && v >= 0, "Quantidade deve ser zero ou maior")
    .transform((v) => Math.round((v + Number.EPSILON) * 1000) / 1000),
  observacao: z.string().trim().optional().or(z.literal("")),
});

export type AjusteInput = z.infer<typeof ajusteSchema>;

export const consumoPecaSchema = z.object({
  pecaId: z.string().trim().min(1, "Peça é obrigatória"),
  quantidade: quantidadeSchema,
});

export type ConsumoPecaInput = z.infer<typeof consumoPecaSchema>;
