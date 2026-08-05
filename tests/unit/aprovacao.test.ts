import { describe, expect, it } from "vitest";
import { precisaComprarPeca } from "@/modules/orcamento/domain/aprovacao";

describe("precisaComprarPeca", () => {
  it("precisa comprar quando a peça é texto livre (sem peca_id)", () => {
    expect(
      precisaComprarPeca([{ pecaId: null, quantidade: 1, estoqueAtual: null }])
    ).toBe(true);
  });

  it("precisa comprar quando o estoque não cobre a quantidade", () => {
    expect(
      precisaComprarPeca([{ pecaId: "p1", quantidade: 3, estoqueAtual: 2 }])
    ).toBe(true);
  });

  it("não precisa comprar quando há estoque suficiente", () => {
    expect(
      precisaComprarPeca([{ pecaId: "p1", quantidade: 2, estoqueAtual: 5 }])
    ).toBe(false);
  });

  it("estoque exatamente igual à quantidade é suficiente", () => {
    expect(
      precisaComprarPeca([{ pecaId: "p1", quantidade: 4, estoqueAtual: 4 }])
    ).toBe(false);
  });

  it("basta um item faltante para precisar comprar", () => {
    expect(
      precisaComprarPeca([
        { pecaId: "p1", quantidade: 1, estoqueAtual: 10 },
        { pecaId: null, quantidade: 1, estoqueAtual: null },
      ])
    ).toBe(true);
  });

  it("lista vazia (nenhuma peça aprovada) não precisa comprar", () => {
    expect(precisaComprarPeca([])).toBe(false);
  });
});
