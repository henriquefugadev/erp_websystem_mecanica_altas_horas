import { describe, expect, it } from "vitest";
import { abaixoDoMinimo, custoMedioPonderado, nivelEstoque, sinalPorTipo } from "@/modules/estoque/domain/estoque";

describe("custoMedioPonderado", () => {
  it("pondera o custo entre o estoque em mãos e a nova entrada", () => {
    // 10 un a R$20 + 10 un a R$30 => média R$25
    expect(custoMedioPonderado(10, 20, 10, 30)).toBe(25);
  });

  it("com estoque zerado, o custo médio vira o custo da própria compra", () => {
    expect(custoMedioPonderado(0, 0, 5, 42.5)).toBe(42.5);
  });

  it("arredonda dízima para 2 casas decimais (custo em centavos)", () => {
    // (2*10.10 + 1*5.20) / 3 = 25.40 / 3 = 8.4666... => 8.47
    expect(custoMedioPonderado(2, 10.1, 1, 5.2)).toBeCloseTo(8.47, 2);
  });
});

describe("nivelEstoque / abaixoDoMinimo", () => {
  it("fica 'zerado' quando o saldo é zero", () => {
    expect(nivelEstoque({ estoque_atual: 0, estoque_minimo: 2 })).toBe("zerado");
    expect(abaixoDoMinimo({ estoque_atual: 0, estoque_minimo: 2 })).toBe(true);
  });

  it("fica 'baixo' quando o saldo é positivo mas não passa do mínimo", () => {
    expect(nivelEstoque({ estoque_atual: 2, estoque_minimo: 2 })).toBe("baixo");
    expect(abaixoDoMinimo({ estoque_atual: 1, estoque_minimo: 2 })).toBe(true);
  });

  it("fica 'ok' quando o saldo passa do mínimo", () => {
    expect(nivelEstoque({ estoque_atual: 5, estoque_minimo: 2 })).toBe("ok");
    expect(abaixoDoMinimo({ estoque_atual: 5, estoque_minimo: 2 })).toBe(false);
  });
});

describe("sinalPorTipo", () => {
  it("entrada e devolução aumentam o saldo", () => {
    expect(sinalPorTipo("entrada")).toBe(1);
    expect(sinalPorTipo("devolucao")).toBe(1);
  });

  it("saída de consumo e perda diminuem o saldo", () => {
    expect(sinalPorTipo("saida_consumo")).toBe(-1);
    expect(sinalPorTipo("perda")).toBe(-1);
  });
});
