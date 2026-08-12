import { z } from "zod";

/**
 * Serviço frequente da oficina, com preço sugerido. Alimenta o autocomplete do
 * orçamento — é o que evita a Michele redigitar "Troca de óleo e filtro" e o
 * preço dele toda semana.
 */
export const servicoCatalogoSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome do serviço").max(80, "Nome muito longo"),
  // 0 = "só o nome no autocomplete, o preço eu digito na hora".
  precoPadrao: z.coerce.number().min(0, "Não pode ser negativo").max(999999.99, "Valor muito alto"),
  // Opcional: quando a oficina cobra por hora, isto vira a base do preço.
  duracaoMinutos: z
    .union([z.coerce.number().int().positive("Deve ser maior que zero").max(9999), z.literal("")])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  ativo: z.boolean().optional().default(true),
});

export type ServicoCatalogoInput = z.output<typeof servicoCatalogoSchema>;
export type ServicoCatalogoFormValues = z.input<typeof servicoCatalogoSchema>;
