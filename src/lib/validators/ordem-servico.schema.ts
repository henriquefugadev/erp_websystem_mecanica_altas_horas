import { z } from "zod";

export const ordemServicoSchema = z.object({
  clienteId: z.string().trim().min(1, "Cliente é obrigatório"),
  veiculoId: z.string().trim().min(1, "Veículo é obrigatório"),
  // Queixa opcional: na recepção o cliente muitas vezes só "larga o carro"
  // sem descrever o problema — a avaliação vem depois, com os mecânicos.
  queixa: z.string().trim().optional().or(z.literal("")),
  descricao: z.string().trim().optional().or(z.literal("")),
  funcionarioId: z.string().trim().optional().or(z.literal("")),
});

export type OrdemServicoInput = z.infer<typeof ordemServicoSchema>;

// Cada item vira sua própria conta a receber no Financeiro (ex.: "Mão de
// obra" R$100 + "Peças" R$100), ligadas à mesma OS.
export const itemConclusaoSchema = z.object({
  categoriaId: z.string().trim().min(1, "Selecione a categoria"),
  valor: z
    .union([z.literal(""), z.coerce.number({ error: "Valor inválido" })])
    .refine((v): v is number => v !== "" && v > 0, "Valor deve ser maior que zero")
    .transform((v) => Math.round((v + Number.EPSILON) * 100) / 100),
});

export type ItemConclusaoInput = z.infer<typeof itemConclusaoSchema>;

// Lista de itens vazia = concluir sem gerar cobrança.
export const concluirOrdemSchema = z
  .object({
    vencimento: z.string().trim().optional().or(z.literal("")),
    itens: z.array(itemConclusaoSchema).default([]),
  })
  .superRefine((dados, ctx) => {
    if (dados.itens.length > 0 && !dados.vencimento) {
      ctx.addIssue({
        code: "custom",
        path: ["vencimento"],
        message: "Informe o vencimento para cobrar.",
      });
    }
  });

export type ConcluirOrdemInput = z.infer<typeof concluirOrdemSchema>;

// Conclusão com revisão do orçamento (Fase 3): a Michele revê o orçamento
// aprovado linha a linha antes de fechar. Cada linha carrega a descrição só
// para conferência — o Financeiro continua agrupando por categoria. `descricao`
// é opcional (linha adicionada na hora pode ficar sem).
export const itemRevisaoConclusaoSchema = itemConclusaoSchema.extend({
  descricao: z.string().trim().optional().or(z.literal("")),
});

export const revisaoConclusaoSchema = z
  .object({
    vencimento: z.string().trim().optional().or(z.literal("")),
    itens: z.array(itemRevisaoConclusaoSchema).default([]),
  })
  .superRefine((dados, ctx) => {
    if (dados.itens.length > 0 && !dados.vencimento) {
      ctx.addIssue({
        code: "custom",
        path: ["vencimento"],
        message: "Informe o vencimento para cobrar.",
      });
    }
  });

export type RevisaoConclusaoInput = z.input<typeof revisaoConclusaoSchema>;
export type RevisaoConclusaoOutput = z.output<typeof revisaoConclusaoSchema>;
