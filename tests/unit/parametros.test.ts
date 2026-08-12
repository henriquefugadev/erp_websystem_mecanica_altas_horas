import { describe, expect, it } from "vitest";
import {
  calcularGarantiaAte,
  ehCategoriaDePeca,
  escolherCategoriaDoItem,
  parametrosPatio,
  PARAMETROS_PADRAO,
} from "@/modules/workshop/domain/parametros";

describe("parametrosPatio — fallback para o comportamento histórico", () => {
  it("sem configuração nenhuma, devolve exatamente os padrões antigos", () => {
    const p = parametrosPatio(null);
    expect(p.galpoes).toEqual([1, 2, 3]);
    expect(p.capacidadeGalpao).toBe(10);
    expect(p.nomesGalpao).toEqual(["Galpão 1", "Galpão 2", "Galpão 3"]);
    expect(p.slaAguardandoHoras).toBe(24);
    expect(p.slaConfirmacaoHoras).toBe(48);
    expect(p.slaExecucaoHoras).toBe(48);
    expect(p.slaParadoHoras).toBe(168);
    expect(p.garantiaMeses).toBe(3);
    expect(p.diasOsConcluidaQuadro).toBe(7);
  });

  it("coluna nula (migração 0023 ainda não rodou) também cai no padrão", () => {
    const p = parametrosPatio({ galpoes_quantidade: null, sla_parado_horas: null });
    expect(p.galpoes).toHaveLength(PARAMETROS_PADRAO.galpoesQuantidade);
    expect(p.slaParadoHoras).toBe(PARAMETROS_PADRAO.slaParadoHoras);
  });

  it("valor fora da faixa ou lixo não derruba a tela — volta ao padrão", () => {
    const p = parametrosPatio({
      galpoes_quantidade: 0,
      galpao_capacidade: -5,
      sla_execucao_horas: Number.NaN,
      dias_os_concluida_quadro: 9999,
    });
    expect(p.galpoes).toEqual([1, 2, 3]);
    expect(p.capacidadeGalpao).toBe(10);
    expect(p.slaExecucaoHoras).toBe(48);
    expect(p.diasOsConcluidaQuadro).toBe(7);
  });

  it("respeita a configuração da oficina quando ela é válida", () => {
    const p = parametrosPatio({
      galpoes_quantidade: 2,
      galpao_capacidade: 4,
      galpao_nomes: ["Elevador", "Box Rápido"],
      sla_aguardando_horas: 8,
      dias_os_concluida_quadro: 15,
    });
    expect(p.galpoes).toEqual([1, 2]);
    expect(p.capacidadeGalpao).toBe(4);
    expect(p.nomesGalpao).toEqual(["Elevador", "Box Rápido"]);
    expect(p.slaAguardandoHoras).toBe(8);
    expect(p.diasOsConcluidaQuadro).toBe(15);
  });

  it("nome faltando ou em branco vira 'Galpão N', sem buraco na lista", () => {
    const p = parametrosPatio({
      galpoes_quantidade: 3,
      galpao_nomes: ["Elevador", "   "],
    });
    expect(p.nomesGalpao).toEqual(["Elevador", "Galpão 2", "Galpão 3"]);
  });

  it("garantia aceita 0 (oficina sem garantia), diferente dos outros campos", () => {
    expect(parametrosPatio({ garantia_meses_padrao: 0 }).garantiaMeses).toBe(0);
    expect(parametrosPatio({ garantia_meses_padrao: 6 }).garantiaMeses).toBe(6);
    // Negativo é inválido — volta ao padrão.
    expect(parametrosPatio({ garantia_meses_padrao: -1 }).garantiaMeses).toBe(3);
  });
});

describe("calcularGarantiaAte", () => {
  it("soma os meses configurados", () => {
    expect(calcularGarantiaAte("2026-08-10", 3)).toBe("2026-11-10");
  });

  it("atravessa o ano corretamente", () => {
    expect(calcularGarantiaAte("2026-11-15", 3)).toBe("2027-02-15");
  });

  it("garantia 0 devolve o próprio dia", () => {
    expect(calcularGarantiaAte("2026-08-10", 0)).toBe("2026-08-10");
  });
});

describe("escolherCategoriaDoItem", () => {
  const categorias = [
    { id: "cat-mo", nome: "Mão de obra" },
    { id: "cat-peca", nome: "Peças" },
    { id: "cat-outros", nome: "Outros" },
  ];
  const semConfig = { categoriaPecaId: null, categoriaMaoObraId: null };

  it("sem configuração, mantém o critério antigo (pelo nome)", () => {
    expect(escolherCategoriaDoItem("peca", categorias, semConfig)).toBe("cat-peca");
    expect(escolherCategoriaDoItem("servico", categorias, semConfig)).toBe("cat-mo");
  });

  it("a categoria configurada tem prioridade sobre o nome", () => {
    const config = { categoriaPecaId: "cat-outros", categoriaMaoObraId: "cat-peca" };
    expect(escolherCategoriaDoItem("peca", categorias, config)).toBe("cat-outros");
    expect(escolherCategoriaDoItem("servico", categorias, config)).toBe("cat-peca");
  });

  it("categoria configurada que foi apagada cai de volta no nome", () => {
    const config = { categoriaPecaId: "cat-que-sumiu", categoriaMaoObraId: null };
    expect(escolherCategoriaDoItem("peca", categorias, config)).toBe("cat-peca");
  });

  it("renomear a categoria sem configurar é justamente o caso que quebrava", () => {
    // "Componentes" não casa com /pe[çc]a/ — sem configuração o item caía na
    // primeira categoria da lista; com configuração, vai para o lugar certo.
    const renomeadas = [
      { id: "cat-mo", nome: "Mão de obra" },
      { id: "cat-comp", nome: "Componentes" },
    ];
    expect(escolherCategoriaDoItem("peca", renomeadas, semConfig)).toBe("cat-mo");
    expect(
      escolherCategoriaDoItem("peca", renomeadas, {
        categoriaPecaId: "cat-comp",
        categoriaMaoObraId: "cat-mo",
      })
    ).toBe("cat-comp");
  });

  it("lista vazia não estoura", () => {
    expect(escolherCategoriaDoItem("peca", [], semConfig)).toBe("");
  });
});

describe("ehCategoriaDePeca", () => {
  const semConfig = { categoriaPecaId: null, categoriaMaoObraId: null };

  it("sem configuração, decide pelo nome (comportamento antigo)", () => {
    expect(ehCategoriaDePeca({ id: "a", nome: "Peças" }, semConfig)).toBe(true);
    expect(ehCategoriaDePeca({ id: "b", nome: "Mão de obra" }, semConfig)).toBe(false);
  });

  it("com configuração, o id manda mesmo que o nome diga outra coisa", () => {
    const config = { categoriaPecaId: "cat-comp", categoriaMaoObraId: "cat-mo" };
    expect(ehCategoriaDePeca({ id: "cat-comp", nome: "Componentes" }, config)).toBe(true);
    expect(ehCategoriaDePeca({ id: "cat-mo", nome: "Peças e serviços" }, config)).toBe(false);
  });

  it("categoria não configurada continua caindo no nome", () => {
    const config = { categoriaPecaId: "cat-comp", categoriaMaoObraId: "cat-mo" };
    expect(ehCategoriaDePeca({ id: "cat-x", nome: "Peça avulsa" }, config)).toBe(true);
  });
});
