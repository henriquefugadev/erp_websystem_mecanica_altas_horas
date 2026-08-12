import { z } from "zod";
import { validarCEP, normalizarCEP, validarTelefone, normalizarTelefone } from "./contato";
import { validarCNPJ, normalizarDocumento } from "./documento";

// Prazo de atenção do quadro, em horas. 1h a 1 ano — mesma faixa do CHECK.
const horasSla = z.coerce
  .number()
  .int()
  .min(1, "Mínimo 1 hora")
  .max(8760, "Máximo 8760 horas (1 ano)");

export const workshopSchema = z.object({
  nome: z.string().trim().min(1, "Nome é obrigatório"),
  razaoSocial: z.string().trim().optional().or(z.literal("")),
  cnpj: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || validarCNPJ(v), "CNPJ inválido")
    .transform((v) => (v ? normalizarDocumento(v) : "")),
  telefone: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || validarTelefone(v), "Telefone inválido")
    .transform((v) => (v ? normalizarTelefone(v) : "")),
  email: z.string().trim().email("E-mail inválido").optional().or(z.literal("")),
  cep: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || validarCEP(v), "CEP inválido")
    .transform((v) => (v ? normalizarCEP(v) : "")),
  logradouro: z.string().trim().optional().or(z.literal("")),
  numero: z.string().trim().optional().or(z.literal("")),
  complemento: z.string().trim().optional().or(z.literal("")),
  bairro: z.string().trim().optional().or(z.literal("")),
  cidade: z.string().trim().optional().or(z.literal("")),
  estado: z
    .string()
    .trim()
    .refine((v) => v === "" || v.length === 2, "UF deve ter 2 letras")
    .transform((v) => (v === "" ? "" : v.toUpperCase()))
    .optional()
    .or(z.literal("")),
  condicoesPagamentoPadrao: z.string().trim().optional().or(z.literal("")),
  // Recebimento (PIX) que aparece no rodapé do PDF da Ordem de Serviço.
  chavePix: z.string().trim().optional().or(z.literal("")),
  pixFavorecido: z.string().trim().optional().or(z.literal("")),
  validadeOrcamentoDias: z.coerce.number().int().min(1, "Mínimo 1 dia"),
  markupPecaPercentual: z.coerce.number().min(0, "Não pode ser negativo"),
  valorHoraMaoObra: z.coerce.number().min(0, "Não pode ser negativo"),
  // Liga/desliga do botão "Aplicar markup" no orçamento — o código fica, só
  // some da tela quando desligado.
  markupHabilitado: z.boolean().optional().default(false),
  // Hrefs de itens da sidebar que ficam escondidos (sem apagar rota/código).
  navOcultos: z.array(z.string()).optional().default([]),

  // --- Parametrização do pátio (migração 0023) ---------------------------
  // Os limites batem com os CHECKs do banco: erro claro no formulário em vez
  // de estouro de constraint depois do clique em salvar.
  galpoesQuantidade: z.coerce
    .number()
    .int()
    .min(1, "Mínimo 1 galpão")
    .max(12, "Máximo 12 galpões"),
  galpaoCapacidade: z.coerce
    .number()
    .int()
    .min(1, "Mínimo 1 vaga")
    .max(99, "Máximo 99 vagas"),
  // Rótulo por galpão, na ordem. Posição vazia = "Galpão N".
  galpaoNomes: z.array(z.string().trim().max(30, "Nome muito longo")).optional().default([]),
  slaAguardandoHoras: horasSla,
  slaConfirmacaoHoras: horasSla,
  slaExecucaoHoras: horasSla,
  slaParadoHoras: horasSla,
  garantiaMesesPadrao: z.coerce
    .number()
    .int()
    .min(0, "Não pode ser negativo")
    .max(120, "Máximo 120 meses"),
  diasOsConcluidaQuadro: z.coerce
    .number()
    .int()
    .min(1, "Mínimo 1 dia")
    .max(365, "Máximo 365 dias"),
  // "" = não configurado; o app volta a decidir a categoria pelo nome.
  categoriaPecaId: z.string().optional().default(""),
  categoriaMaoObraId: z.string().optional().default(""),
});

// workshopSchema termina com .transform() em vários campos; o formulário
// trabalha com o formato de entrada (pré-transform) e o resolver produz o
// formato de saída — mesmo padrão de cliente-form-schema.ts.
export type WorkshopFormValues = z.input<typeof workshopSchema>;
export type WorkshopInput = z.output<typeof workshopSchema>;
