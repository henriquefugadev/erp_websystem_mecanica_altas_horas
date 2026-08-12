import { describe, expect, it } from "vitest";
import { montarHistoricoOs, type OrdemHistoricoRaw } from "@/modules/patio/domain/historico";

function ordemBase(over: Partial<OrdemHistoricoRaw> = {}): OrdemHistoricoRaw {
  return {
    id: "os1",
    numero: 10,
    titulo: null,
    status: "concluido",
    data_abertura: "2026-08-01T10:00:00Z",
    data_conclusao: "2026-08-02T10:00:00Z",
    garantia_ate: "2026-11-02",
    queixa: "Barulho na frente",
    veiculo: { id: "v1", modelo: "Gol", marca: "VW", placa: "ABC1D23", cor: "Prata" },
    funcionario: { nome: "Zé" },
    orcamento: [],
    ...over,
  };
}

describe("montarHistoricoOs", () => {
  it("usa o orçamento aprovado e só os itens aprovados", () => {
    const [os] = montarHistoricoOs([
      ordemBase({
        orcamento: [
          {
            status: "aprovado",
            orcamento_item: [
              { descricao: "Pastilha", tipo: "peca", quantidade: 2, preco_unitario: 100, desconto: 0, aprovado: true },
              { descricao: "Item recusado", tipo: "peca", quantidade: 1, preco_unitario: 999, desconto: 0, aprovado: false },
              { descricao: "Mão de obra", tipo: "servico", quantidade: 1, preco_unitario: 150, desconto: 0, aprovado: true },
            ],
          },
        ],
      }),
    ]);

    expect(os.aprovado).toBe(true);
    expect(os.itens).toHaveLength(2);
    expect(os.total).toBe(350); // 2×100 + 150
    expect(os.veiculo?.nome).toBe("VW Gol");
    expect(os.veiculo?.cor).toBe("Prata");
    expect(os.garantiaAte).toBe("2026-11-02");
  });

  it("mostra a proposta (não aprovado) quando não há orçamento aprovado", () => {
    const [os] = montarHistoricoOs([
      ordemBase({
        status: "aguardando",
        orcamento: [
          {
            status: "rascunho",
            orcamento_item: [
              { descricao: "Filtro", tipo: "peca", quantidade: 1, preco_unitario: 60, desconto: 0, aprovado: null },
            ],
          },
        ],
      }),
    ]);

    expect(os.aprovado).toBe(false);
    expect(os.itens).toHaveLength(1);
    expect(os.total).toBe(60);
  });

  it("lida com OS sem orçamento", () => {
    const [os] = montarHistoricoOs([ordemBase({ orcamento: [] })]);
    expect(os.itens).toHaveLength(0);
    expect(os.total).toBe(0);
  });

  it("aplica desconto no subtotal", () => {
    const [os] = montarHistoricoOs([
      ordemBase({
        orcamento: [
          {
            status: "aprovado_parcial",
            orcamento_item: [
              { descricao: "Peça", tipo: "peca", quantidade: 1, preco_unitario: 100, desconto: 10, aprovado: true },
            ],
          },
        ],
      }),
    ]);
    expect(os.total).toBe(90);
  });
});
