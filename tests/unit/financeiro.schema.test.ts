import { describe, expect, it } from "vitest";
import { contaSchema } from "@/lib/validators/financeiro.schema";

describe("contaSchema", () => {
  it("aceita conta a pagar sem fornecedor", () => {
    const resultado = contaSchema.safeParse({
      tipo: "pagar",
      descricao: "Compra de óleo lubrificante",
      categoriaId: "cat-1",
      valorTotal: "150.00",
      dataEmissao: "2026-08-08",
      fornecedorNome: "",
      observacoes: "",
      parcelas: [
        {
          numero: 1,
          valor: "150.00",
          vencimento: "2026-08-15",
        },
      ],
    });

    expect(resultado.success).toBe(true);
  });
});
