import { z } from "zod";

// Rascunho de orçamento vinculado à OS — editado no popup "Orçamento" do pátio
// (Fase 2). A Michele monta aqui a lista completa: tipo, descrição, quantidade,
// preço e desconto. O custo cotado é opcional (serve à margem e à compra por
// fornecedor). Os números chegam do formulário como string e são coeridos aqui;
// campo vazio vira 0 (ou null, no custo). O nome "diagnostico" é histórico — a
// mesma lista nasce aqui e vive até a compra, sem redigitar.

// Dinheiro obrigatório do form: "" (ou ausente) vira 0.
const dinheiro = z
  .union([z.literal(""), z.coerce.number({ error: "Valor inválido" })])
  .optional()
  .transform((v) => (v === "" || v === undefined ? 0 : v));

// Custo é opcional de verdade: "" (ou ausente) vira null, não 0 — para
// distinguir "sem cotação" de "custo zero" na margem e na fase de compra.
const custoOpcional = z
  .union([z.literal(""), z.coerce.number({ error: "Custo inválido" })])
  .nullish()
  .transform((v) => (v === "" || v == null ? null : v));

export const itemDiagnosticoSchema = z.object({
  tipo: z.enum(["peca", "servico"]),
  descricao: z.string().trim().min(1, "Descreva o item"),
  quantidade: z
    .union([z.literal(""), z.coerce.number({ error: "Quantidade inválida" })])
    .refine((v): v is number => v !== "" && v > 0, "Quantidade deve ser maior que zero"),
  pecaId: z.string().trim().optional().or(z.literal("")),
  fornecedorId: z.string().trim().optional().or(z.literal("")),
  precoUnitario: dinheiro,
  desconto: dinheiro,
  custoCotado: custoOpcional,
});

export const diagnosticoSchema = z.object({
  itens: z.array(itemDiagnosticoSchema).min(1, "Adicione ao menos um item"),
});

export type DiagnosticoInput = z.input<typeof diagnosticoSchema>;
export type DiagnosticoOutput = z.output<typeof diagnosticoSchema>;
export type ItemDiagnosticoInput = z.input<typeof itemDiagnosticoSchema>;
