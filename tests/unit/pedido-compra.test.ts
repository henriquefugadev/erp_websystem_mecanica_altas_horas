import { describe, expect, it } from "vitest";
import {
  podeCancelar,
  podeReceber,
  saldoItem,
  statusPedido,
  totalPedido,
} from "@/modules/fornecedores/domain/pedido";

describe("saldoItem", () => {
  it("calcula a diferença entre pedido e recebido", () => {
    expect(saldoItem({ quantidade: 10, quantidade_recebida: 4 })).toBe(6);
  });

  it("chega a zero quando tudo foi recebido", () => {
    expect(saldoItem({ quantidade: 5, quantidade_recebida: 5 })).toBe(0);
  });

  it("evita erro de ponto flutuante (3 casas decimais)", () => {
    expect(saldoItem({ quantidade: 1.1, quantidade_recebida: 0.3 })).toBe(0.8);
  });
});

describe("totalPedido", () => {
  it("soma quantidade × preço unitário de todos os itens", () => {
    const itens = [
      { quantidade: 4, preco_unitario: 25 },
      { quantidade: 2, preco_unitario: 40 },
    ];
    expect(totalPedido(itens)).toBe(180);
  });

  it("evita erro de ponto flutuante ao somar centavos", () => {
    const itens = [
      { quantidade: 3, preco_unitario: 10.1 },
      { quantidade: 1, preco_unitario: 0.2 },
    ];
    expect(totalPedido(itens)).toBeCloseTo(30.5, 2);
  });
});

describe("statusPedido", () => {
  it("sem itens fica aberto", () => {
    expect(statusPedido([])).toBe("aberto");
  });

  it("nenhum item recebido fica aberto", () => {
    const itens = [
      { quantidade: 10, quantidade_recebida: 0 },
      { quantidade: 5, quantidade_recebida: 0 },
    ];
    expect(statusPedido(itens)).toBe("aberto");
  });

  it("algum item com saldo pendente fica parcial", () => {
    const itens = [
      { quantidade: 10, quantidade_recebida: 10 },
      { quantidade: 5, quantidade_recebida: 2 },
    ];
    expect(statusPedido(itens)).toBe("parcial");
  });

  it("todos os itens totalmente recebidos fica recebido", () => {
    const itens = [
      { quantidade: 10, quantidade_recebida: 10 },
      { quantidade: 5, quantidade_recebida: 5 },
    ];
    expect(statusPedido(itens)).toBe("recebido");
  });
});

describe("podeReceber / podeCancelar", () => {
  it("permite receber e cancelar quando aberto ou parcial", () => {
    expect(podeReceber("aberto")).toBe(true);
    expect(podeReceber("parcial")).toBe(true);
    expect(podeCancelar("aberto")).toBe(true);
    expect(podeCancelar("parcial")).toBe(true);
  });

  it("bloqueia receber e cancelar quando recebido ou cancelado", () => {
    expect(podeReceber("recebido")).toBe(false);
    expect(podeReceber("cancelado")).toBe(false);
    expect(podeCancelar("recebido")).toBe(false);
    expect(podeCancelar("cancelado")).toBe(false);
  });
});
