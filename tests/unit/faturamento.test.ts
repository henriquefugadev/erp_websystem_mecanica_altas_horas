import { describe, expect, it } from "vitest";
import { classificarFaturamento } from "@/modules/financeiro/domain/faturamento";

describe("classificarFaturamento", () => {
  it("separa peças de mão de obra/serviço pelo nome da categoria", () => {
    const resumo = classificarFaturamento([
      { categoriaId: "1", categoriaNome: "Peças", total: 800 },
      { categoriaId: "2", categoriaNome: "Mão de obra", total: 700 },
      { categoriaId: "3", categoriaNome: "Outras receitas", total: 100 },
    ]);

    expect(resumo.pecas).toBe(800);
    // Mão de obra + outras receitas entram como serviço.
    expect(resumo.servicos).toBe(800);
    expect(resumo.total).toBe(1600);
  });

  it("reconhece 'Peça' no singular e sem acento", () => {
    expect(classificarFaturamento([{ categoriaId: "1", categoriaNome: "Peca", total: 50 }]).pecas).toBe(50);
    expect(classificarFaturamento([{ categoriaId: "1", categoriaNome: "Peça avulsa", total: 50 }]).pecas).toBe(50);
  });

  it("arredonda para centavos", () => {
    const resumo = classificarFaturamento([
      { categoriaId: "1", categoriaNome: "Peças", total: 10.005 },
      { categoriaId: "2", categoriaNome: "Serviço", total: 0.1 },
    ]);
    expect(resumo.pecas).toBe(10.01);
    expect(resumo.servicos).toBe(0.1);
    expect(resumo.total).toBe(10.11);
  });

  it("devolve zeros quando não há faturamento", () => {
    expect(classificarFaturamento([])).toEqual({
      pecas: 0,
      servicos: 0,
      total: 0,
      categorias: [],
    });
  });
});
