import { describe, expect, it } from "vitest";
import {
  aplicarMarkup,
  calcularMargemPercentual,
  calcularSubtotalItem,
  calcularTotalOrcamento,
} from "@/modules/orcamento/domain/calculo";

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

describe("aplicarMarkup", () => {
  it("aplica o markup percentual sobre o custo", () => {
    expect(aplicarMarkup(100, 30)).toBe(130);
  });

  it("markup zero devolve o próprio custo", () => {
    expect(aplicarMarkup(80, 0)).toBe(80);
  });

  it("arredonda o preço ao centavo mais próximo", () => {
    // 49,90 × 1,35 = 67,365 → 67,37
    expect(aplicarMarkup(49.9, 35)).toBe(67.37);
  });

  it("aceita markup fracionário", () => {
    expect(aplicarMarkup(200, 12.5)).toBe(225);
  });
});

describe("calcularMargemPercentual", () => {
  it("calcula a margem sobre o preço de venda", () => {
    // custo 100, preço 130 → (130-100)/130 = 23,0769... → 23,08
    expect(calcularMargemPercentual(130, 100)).toBe(23.08);
  });

  it("retorna null sem custo cotado", () => {
    expect(calcularMargemPercentual(130, null)).toBeNull();
  });

  it("retorna null quando o preço é zero (item sem preço ainda)", () => {
    expect(calcularMargemPercentual(0, 50)).toBeNull();
  });

  it("margem 100% quando o custo é zero", () => {
    expect(calcularMargemPercentual(200, 0)).toBe(100);
  });
});
