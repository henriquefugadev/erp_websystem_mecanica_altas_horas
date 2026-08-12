import { describe, expect, it } from "vitest";
import {
  erroOrcamentoFinalizado,
  orcamentoTemDesfecho,
} from "@/modules/orcamento/domain/status";

describe("orcamentoTemDesfecho", () => {
  it("bloqueia os status em que o cliente já respondeu ou a oficina cancelou", () => {
    // Aprovar de novo um orçamento aprovado geraria uma segunda leva de pedidos
    // de compra para as mesmas peças — é o motivo do guard existir.
    expect(orcamentoTemDesfecho("aprovado")).toBe(true);
    expect(orcamentoTemDesfecho("aprovado_parcial")).toBe(true);
    expect(orcamentoTemDesfecho("recusado")).toBe(true);
    expect(orcamentoTemDesfecho("cancelado")).toBe(true);
  });

  it("libera enquanto o orçamento ainda está em jogo", () => {
    expect(orcamentoTemDesfecho("rascunho")).toBe(false);
    expect(orcamentoTemDesfecho("enviado")).toBe(false);
  });

  it("mensagem de erro nomeia o status e a ação recusada", () => {
    expect(erroOrcamentoFinalizado("aprovado", "cancelar")).toBe(
      'Orçamento está "Aprovado", não é possível cancelar.'
    );
  });
});
