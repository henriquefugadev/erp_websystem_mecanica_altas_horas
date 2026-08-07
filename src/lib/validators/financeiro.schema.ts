import { z } from "zod";
import { FORMAS_PAGAMENTO } from "@/modules/financeiro/domain/types";

// Arredonda para 2 casas decimais no schema para que o valor que chega ao
// banco (NUMERIC(13,2)) sempre bata com o que o formulário mostrou. Segue o
// mesmo padrão union(""|coerce.number) de veiculo.schema.ts (campo "ano")
// para que o input do formulário comece vazio sem quebrar a tipagem.
const valorMonetarioSchema = z
  .union([z.literal(""), z.coerce.number({ error: "Valor inválido" })])
  .refine((v): v is number => v !== "" && v > 0, "Valor deve ser maior que zero")
  .transform((v) => Math.round((v + Number.EPSILON) * 100) / 100);

const descontoSchema = z
  .union([z.literal(""), z.coerce.number().min(0, "Desconto não pode ser negativo")])
  .transform((v) => (v === "" ? 0 : Math.round((v + Number.EPSILON) * 100) / 100))
  .optional();

export const categoriaSchema = z.object({
  tipo: z.enum(["receita", "despesa"]),
  nome: z.string().trim().min(1, "Nome é obrigatório").max(80, "Nome muito longo"),
});

export type CategoriaInput = z.infer<typeof categoriaSchema>;

export const parcelaInputSchema = z.object({
  numero: z.coerce.number().int().positive(),
  valor: valorMonetarioSchema,
  vencimento: z.string().min(1, "Vencimento é obrigatório"),
});

export const contaSchema = z
  .object({
    tipo: z.enum(["receber", "pagar"]),
    descricao: z.string().trim().min(1, "Descrição é obrigatória"),
    categoriaId: z.string().trim().min(1, "Categoria é obrigatória"),
    clienteId: z.string().trim().optional().or(z.literal("")),
    fornecedorNome: z.string().trim().optional().or(z.literal("")),
    valorTotal: valorMonetarioSchema,
    dataEmissao: z.string().min(1, "Data de emissão é obrigatória"),
    observacoes: z.string().trim().optional().or(z.literal("")),
    parcelas: z.array(parcelaInputSchema).min(1, "Inclua ao menos uma parcela"),
  })
  .superRefine((dados, ctx) => {
    const somaParcelasCentavos = dados.parcelas.reduce(
      (acc, p) => acc + Math.round(p.valor * 100),
      0
    );
    if (somaParcelasCentavos !== Math.round(dados.valorTotal * 100)) {
      ctx.addIssue({
        code: "custom",
        path: ["parcelas"],
        message: "A soma das parcelas deve ser igual ao valor total.",
      });
    }

    if (dados.tipo === "pagar" && !dados.fornecedorNome) {
      ctx.addIssue({
        code: "custom",
        path: ["fornecedorNome"],
        message: "Fornecedor é obrigatório para contas a pagar.",
      });
    }
  });

export type ContaInput = z.infer<typeof contaSchema>;

export const pagamentoSchema = z.object({
  valor: valorMonetarioSchema,
  desconto: descontoSchema,
  dataPagamento: z.string().min(1, "Data é obrigatória"),
  formaPagamento: z.enum(FORMAS_PAGAMENTO),
  observacoes: z.string().trim().optional().or(z.literal("")),
});

export type PagamentoInput = z.infer<typeof pagamentoSchema>;

// Recebimento em lote ao entregar o carro (Fase 4): a Michele registra que o
// cliente pagou tudo. O valor vem de cada parcela em aberto da OS — ela só
// escolhe forma e data. Sem campo de valor: quita o saldo integral.
export const receberPagamentoSchema = z.object({
  dataPagamento: z.string().min(1, "Data é obrigatória"),
  formaPagamento: z.enum(FORMAS_PAGAMENTO),
  observacoes: z.string().trim().optional().or(z.literal("")),
});

export type ReceberPagamentoInput = z.infer<typeof receberPagamentoSchema>;
