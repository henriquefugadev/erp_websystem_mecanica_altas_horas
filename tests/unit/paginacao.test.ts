import { describe, expect, it } from "vitest";
import { LIMITE_MAXIMO, PAGINA, limiteDaUrl, recortar } from "@/lib/paginacao";

describe("limiteDaUrl", () => {
  it("sem parâmetro, traz a primeira página", () => {
    expect(limiteDaUrl(undefined)).toBe(PAGINA);
    expect(limiteDaUrl("")).toBe(PAGINA);
  });

  it("respeita o valor pedido quando é múltiplo da página", () => {
    expect(limiteDaUrl(String(PAGINA * 2))).toBe(PAGINA * 2);
    expect(limiteDaUrl(String(PAGINA * 3))).toBe(PAGINA * 3);
  });

  it("arredonda para cima: o parâmetro não vira um jeito de pedir N linhas", () => {
    // Alguém editando a URL à mão não consegue pedir 1 linha nem 137.
    expect(limiteDaUrl("1")).toBe(PAGINA);
    expect(limiteDaUrl(String(PAGINA + 1))).toBe(PAGINA * 2);
  });

  it("não passa do teto, mesmo com um número absurdo", () => {
    expect(limiteDaUrl("999999")).toBe(LIMITE_MAXIMO);
  });

  it("lixo e valores inválidos caem na primeira página", () => {
    for (const entrada of ["abc", "-10", "0", "NaN", "Infinity", "1e40"]) {
      expect(limiteDaUrl(entrada)).toBeLessThanOrEqual(LIMITE_MAXIMO);
      expect(limiteDaUrl(entrada)).toBeGreaterThanOrEqual(PAGINA);
    }
    expect(limiteDaUrl("abc")).toBe(PAGINA);
    expect(limiteDaUrl("-10")).toBe(PAGINA);
  });
});

describe("recortar", () => {
  it("com a linha extra presente, corta e avisa que há mais", () => {
    // A listagem pede limite+1 justamente para descobrir isso sem um count().
    const { itens, temMais } = recortar([1, 2, 3, 4], 3);
    expect(itens).toEqual([1, 2, 3]);
    expect(temMais).toBe(true);
  });

  it("exatamente no limite significa fim da lista", () => {
    const { itens, temMais } = recortar([1, 2, 3], 3);
    expect(itens).toEqual([1, 2, 3]);
    expect(temMais).toBe(false);
  });

  it("lista curta passa inteira", () => {
    const { itens, temMais } = recortar([1], 50);
    expect(itens).toEqual([1]);
    expect(temMais).toBe(false);
  });

  it("lista vazia não quebra", () => {
    expect(recortar([], 50)).toEqual({ itens: [], temMais: false });
  });
});
