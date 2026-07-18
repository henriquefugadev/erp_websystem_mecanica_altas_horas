import { describe, expect, it } from "vitest";
import {
  centavosParaReais,
  gerarParcelas,
  parcelaVencida,
  reaisParaCentavos,
  saldoParcelaCentavos,
  statusConta,
  statusExibicaoParcela,
  statusParcela,
  validarPagamento,
} from "@/modules/financeiro/domain/baixa";

describe("reaisParaCentavos / centavosParaReais", () => {
  it("converte sem erro de ponto flutuante", () => {
    expect(reaisParaCentavos(1500)).toBe(150000);
    expect(reaisParaCentavos(10.1)).toBe(1010);
    expect(reaisParaCentavos(0.29)).toBe(29);
    expect(centavosParaReais(150000)).toBe(1500);
  });
});

describe("saldoParcelaCentavos / validarPagamento", () => {
  it("pagamento parcial: R$1000 com R$600 pago deixa R$400 em aberto", () => {
    const valor = reaisParaCentavos(1000);
    const pago = reaisParaCentavos(600);
    const saldo = saldoParcelaCentavos(valor, pago, 0);
    expect(centavosParaReais(saldo)).toBe(400);
    expect(statusParcela(valor, pago, 0)).toBe("parcial");
  });

  it("pagamento total quita a parcela (status liquidada)", () => {
    const valor = reaisParaCentavos(500);
    expect(statusParcela(valor, valor, 0)).toBe("liquidada");
  });

  it("pagamento excedente é rejeitado", () => {
    const valor = reaisParaCentavos(500);
    const jaPago = reaisParaCentavos(500);
    const saldo = saldoParcelaCentavos(valor, jaPago, 0);
    const resultado = validarPagamento(saldo, reaisParaCentavos(100), 0);
    expect(resultado.ok).toBe(false);
  });

  it("aceita pagamento que exatamente quita o saldo restante", () => {
    const valor = reaisParaCentavos(500);
    const saldo = saldoParcelaCentavos(valor, 0, 0);
    const resultado = validarPagamento(saldo, saldo, 0);
    expect(resultado.ok).toBe(true);
  });

  it("desconto soma ao valor pago para efeito de saldo", () => {
    const valor = reaisParaCentavos(500);
    const saldo = saldoParcelaCentavos(valor, 0, 0);
    const resultado = validarPagamento(saldo, reaisParaCentavos(480), reaisParaCentavos(20));
    expect(resultado.ok).toBe(true);
    expect(statusParcela(valor, reaisParaCentavos(480), reaisParaCentavos(20))).toBe("liquidada");
  });

  it("rejeita valor pago zero ou negativo", () => {
    expect(validarPagamento(reaisParaCentavos(500), 0, 0).ok).toBe(false);
  });
});

describe("estorno (reabertura via lançamento compensatório)", () => {
  it("subtrair o valor estornado reabre o saldo e volta o status para parcial/aberta", () => {
    const valor = reaisParaCentavos(500);
    const pagoOriginal = reaisParaCentavos(500);
    expect(statusParcela(valor, pagoOriginal, 0)).toBe("liquidada");

    // estorno de R$200: novo valor pago é 300
    const pagoAposEstorno = pagoOriginal - reaisParaCentavos(200);
    expect(statusParcela(valor, pagoAposEstorno, 0)).toBe("parcial");
    expect(centavosParaReais(saldoParcelaCentavos(valor, pagoAposEstorno, 0))).toBe(200);
  });
});

describe("parcelaVencida / statusExibicaoParcela", () => {
  const hoje = new Date("2026-07-18T00:00:00Z");

  it("marca como vencida quando aberta/parcial e vencimento passou", () => {
    expect(parcelaVencida("aberta", new Date("2026-07-10T00:00:00Z"), hoje)).toBe(true);
    expect(parcelaVencida("parcial", new Date("2026-07-17T00:00:00Z"), hoje)).toBe(true);
  });

  it("não marca como vencida no dia do vencimento nem no futuro", () => {
    expect(parcelaVencida("aberta", new Date("2026-07-18T00:00:00Z"), hoje)).toBe(false);
    expect(parcelaVencida("aberta", new Date("2026-08-01T00:00:00Z"), hoje)).toBe(false);
  });

  it("parcela liquidada ou cancelada nunca é vencida", () => {
    expect(parcelaVencida("liquidada", new Date("2026-01-01T00:00:00Z"), hoje)).toBe(false);
    expect(parcelaVencida("cancelada", new Date("2026-01-01T00:00:00Z"), hoje)).toBe(false);
  });

  it("statusExibicaoParcela retorna 'vencida' sobrepondo o status bruto", () => {
    expect(statusExibicaoParcela("parcial", new Date("2026-07-01T00:00:00Z"), hoje)).toBe(
      "vencida"
    );
    expect(statusExibicaoParcela("liquidada", new Date("2026-07-01T00:00:00Z"), hoje)).toBe(
      "liquidada"
    );
  });
});

describe("statusConta", () => {
  it("todas liquidadas -> conta liquidada", () => {
    expect(statusConta(["liquidada", "liquidada"])).toBe("liquidada");
  });

  it("nenhuma paga -> conta aberta", () => {
    expect(statusConta(["aberta", "aberta"])).toBe("aberta");
  });

  it("mistura de status -> conta parcial", () => {
    expect(statusConta(["liquidada", "aberta"])).toBe("parcial");
    expect(statusConta(["parcial", "aberta"])).toBe("parcial");
  });
});

describe("gerarParcelas", () => {
  it("divide o total igualmente quando é múltiplo do número de parcelas", () => {
    const parcelas = gerarParcelas(
      reaisParaCentavos(1500),
      3,
      new Date("2026-07-15T00:00:00Z"),
      30
    );
    expect(parcelas).toHaveLength(3);
    expect(parcelas.map((p) => p.valorCentavos)).toEqual([50000, 50000, 50000]);
    expect(parcelas[1].vencimento.toISOString().slice(0, 10)).toBe("2026-08-14");
    expect(parcelas[2].vencimento.toISOString().slice(0, 10)).toBe("2026-09-13");
  });

  it("soma das parcelas é sempre igual ao total, mesmo com resto de arredondamento", () => {
    const totalCentavos = reaisParaCentavos(100);
    const parcelas = gerarParcelas(totalCentavos, 3, new Date("2026-07-15T00:00:00Z"), 30);
    const soma = parcelas.reduce((acc, p) => acc + p.valorCentavos, 0);
    expect(soma).toBe(totalCentavos);
    // sobra vai para a primeira parcela
    expect(parcelas[0].valorCentavos).toBe(3334);
    expect(parcelas[1].valorCentavos).toBe(3333);
    expect(parcelas[2].valorCentavos).toBe(3333);
  });

  it("uma única parcela recebe o valor total", () => {
    const parcelas = gerarParcelas(reaisParaCentavos(250), 1, new Date("2026-07-15T00:00:00Z"), 30);
    expect(parcelas).toEqual([
      { numero: 1, valorCentavos: 25000, vencimento: new Date("2026-07-15T00:00:00Z") },
    ]);
  });

  it("rejeita número de parcelas inválido", () => {
    expect(() => gerarParcelas(1000, 0, new Date(), 30)).toThrow();
  });
});
