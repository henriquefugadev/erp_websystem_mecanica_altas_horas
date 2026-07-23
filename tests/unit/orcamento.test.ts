import { describe, expect, it } from "vitest";
import { calcularSubtotalItem, calcularTotalOrcamento } from "@/modules/orcamento/domain/calculo";

describe("calcularSubtotalItem", () => {
  it("multiplica quantidade pelo preço unitário", () => {
    expect(calcularSubtotalItem({ quantidade: 2, precoUnitario: 50 })).toBe(100);
  });

  it("aplica o desconto informado", () => {
    expect(calcularSubtotalItem({ quantidade: 1, precoUnitario: 100, desconto: 10 })).toBe(90);
  });

  it("arredonda para o centavo mais próximo (evita erro de ponto flutuante)", () => {
    expect(calcularSubtotalItem({ quantidade: 3, precoUnitario: 0.1 })).toBe(0.3);
  });
});

describe("calcularTotalOrcamento", () => {
  it("soma o subtotal de vários itens", () => {
    const total = calcularTotalOrcamento([
      { quantidade: 1, precoUnitario: 150, desconto: 0 },
      { quantidade: 2, precoUnitario: 20 },
    ]);
    expect(total).toBe(190);
  });

  it("retorna 0 para lista vazia", () => {
    expect(calcularTotalOrcamento([])).toBe(0);
  });

  it("soma descontos compostos de itens diferentes corretamente", () => {
    const total = calcularTotalOrcamento([
      { quantidade: 1, precoUnitario: 100, desconto: 15 },
      { quantidade: 1, precoUnitario: 200, desconto: 25 },
    ]);
    expect(total).toBe(260);
  });
});
