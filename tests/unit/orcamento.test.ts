import { describe, expect, it } from "vitest";
import {
  agruparValoresPorCategoria,
  aplicarMarkup,
  calcularConclusaoDoOrcamento,
  calcularMargemPercentual,
  calcularSubtotalItem,
  calcularTotalOrcamento,
  totalDaLinhaParaUnitario,
  unitarioParaTotalDaLinha,
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

describe("totalDaLinhaParaUnitario", () => {
  it("divide o total da linha pela quantidade", () => {
    expect(totalDaLinhaParaUnitario(160, 4)).toBe(40);
  });

  it("quantidade <= 0 devolve o próprio total (sem dividir por zero)", () => {
    expect(totalDaLinhaParaUnitario(160, 0)).toBe(160);
    expect(totalDaLinhaParaUnitario(160, -1)).toBe(160);
  });

  it("arredonda o unitário ao centavo quando não divide exato", () => {
    // 100 / 3 = 33,333… → 33,33
    expect(totalDaLinhaParaUnitario(100, 3)).toBe(33.33);
  });
});

describe("unitarioParaTotalDaLinha", () => {
  it("multiplica o unitário pela quantidade", () => {
    expect(unitarioParaTotalDaLinha(40, 4)).toBe(160);
  });

  it("arredonda o total ao centavo mais próximo", () => {
    expect(unitarioParaTotalDaLinha(0.1, 3)).toBe(0.3);
  });

  it("faz a volta com o unitário arredondado (round-trip aproximado)", () => {
    // 100/3 → 33,33 → ×3 = 99,99 (o centavo de diferença é esperado)
    const unitario = totalDaLinhaParaUnitario(100, 3);
    expect(unitarioParaTotalDaLinha(unitario, 3)).toBe(99.99);
  });

  it("round-trip exato quando a quantidade divide o total", () => {
    const unitario = totalDaLinhaParaUnitario(160, 4);
    expect(unitarioParaTotalDaLinha(unitario, 4)).toBe(160);
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

describe("calcularConclusaoDoOrcamento", () => {
  it("separa a soma por tipo (peças x serviços)", () => {
    const r = calcularConclusaoDoOrcamento([
      { tipo: "peca", quantidade: 2, precoUnitario: 130 },
      { tipo: "peca", quantidade: 1, precoUnitario: 65 },
      { tipo: "servico", quantidade: 1, precoUnitario: 200 },
    ]);
    expect(r.pecas).toBe(325);
    expect(r.servicos).toBe(200);
  });

  it("aplica desconto por item na soma", () => {
    const r = calcularConclusaoDoOrcamento([
      { tipo: "servico", quantidade: 1, precoUnitario: 300, desconto: 50 },
    ]);
    expect(r.servicos).toBe(250);
    expect(r.pecas).toBe(0);
  });

  it("lista vazia zera os dois", () => {
    expect(calcularConclusaoDoOrcamento([])).toEqual({ pecas: 0, servicos: 0 });
  });
});

describe("agruparValoresPorCategoria", () => {
  it("soma os valores das linhas da mesma categoria", () => {
    const r = agruparValoresPorCategoria([
      { categoriaId: "pecas", valor: 130 },
      { categoriaId: "pecas", valor: 65 },
      { categoriaId: "mao", valor: 200 },
    ]);
    expect(r).toEqual([
      { categoriaId: "pecas", valor: 195 },
      { categoriaId: "mao", valor: 200 },
    ]);
  });

  it("mantém a ordem da primeira ocorrência de cada categoria", () => {
    const r = agruparValoresPorCategoria([
      { categoriaId: "mao", valor: 100 },
      { categoriaId: "pecas", valor: 50 },
      { categoriaId: "mao", valor: 20 },
    ]);
    expect(r.map((i) => i.categoriaId)).toEqual(["mao", "pecas"]);
    expect(r[0].valor).toBe(120);
  });

  it("arredonda o total de cada categoria ao centavo", () => {
    const r = agruparValoresPorCategoria([
      { categoriaId: "pecas", valor: 0.1 },
      { categoriaId: "pecas", valor: 0.2 },
    ]);
    expect(r[0].valor).toBe(0.3);
  });

  it("lista vazia devolve lista vazia", () => {
    expect(agruparValoresPorCategoria([])).toEqual([]);
  });
});
