import { describe, expect, it } from "vitest";
import {
  galpaoMenosOcupado,
  LIMITE_AGUARDANDO_HORAS,
  LIMITE_EXECUCAO_HORAS,
  LIMITE_PARADO_HORAS,
  lotacaoGalpoes,
  nivelAtencao,
  statusPagamento,
  transicaoPermitida,
  type OrdemParaLotacao,
} from "@/modules/patio/domain/status";
import { CAPACIDADE_GALPAO } from "@/modules/patio/domain/types";

describe("transicaoPermitida", () => {
  it("permite aguardando -> em_execucao e aguardando -> cancelada", () => {
    expect(transicaoPermitida("aguardando", "em_execucao")).toBe(true);
    expect(transicaoPermitida("aguardando", "cancelada")).toBe(true);
  });

  it("permite em_execucao -> aguardando (voltar), -> parado (pausar) e -> concluido", () => {
    expect(transicaoPermitida("em_execucao", "aguardando")).toBe(true);
    expect(transicaoPermitida("em_execucao", "parado")).toBe(true);
    expect(transicaoPermitida("em_execucao", "concluido")).toBe(true);
  });

  it("permite parado -> em_execucao (retomar) e -> cancelada", () => {
    expect(transicaoPermitida("parado", "em_execucao")).toBe(true);
    expect(transicaoPermitida("parado", "cancelada")).toBe(true);
  });

  it("bloqueia pular etapas ou ir direto de/para estados terminais", () => {
    expect(transicaoPermitida("aguardando", "concluido")).toBe(false);
    expect(transicaoPermitida("aguardando", "parado")).toBe(false);
    expect(transicaoPermitida("concluido", "em_execucao")).toBe(false);
    expect(transicaoPermitida("parado", "aguardando")).toBe(false);
  });

  it("bloqueia qualquer transição a partir de concluido ou cancelada", () => {
    expect(transicaoPermitida("concluido", "cancelada")).toBe(false);
    expect(transicaoPermitida("cancelada", "aguardando")).toBe(false);
  });
});

describe("nivelAtencao", () => {
  const agora = new Date("2026-07-18T12:00:00Z");

  it("aguardando dentro do limite fica ok", () => {
    const abertura = new Date(agora.getTime() - (LIMITE_AGUARDANDO_HORAS - 1) * 60 * 60 * 1000);
    expect(nivelAtencao("aguardando", abertura, null, null, agora)).toBe("ok");
  });

  it("aguardando além do limite vira atencao", () => {
    const abertura = new Date(agora.getTime() - (LIMITE_AGUARDANDO_HORAS + 1) * 60 * 60 * 1000);
    expect(nivelAtencao("aguardando", abertura, null, null, agora)).toBe("atencao");
  });

  it("em_execucao usa data_inicio, não data_abertura", () => {
    const abertura = new Date(agora.getTime() - 999 * 60 * 60 * 1000); // aberta há muito tempo
    const inicio = new Date(agora.getTime() - 1 * 60 * 60 * 1000); // iniciada há 1h
    expect(nivelAtencao("em_execucao", abertura, inicio, null, agora)).toBe("ok");
  });

  it("em_execucao além do limite vira atencao", () => {
    const abertura = new Date(agora.getTime() - 999 * 60 * 60 * 1000);
    const inicio = new Date(agora.getTime() - (LIMITE_EXECUCAO_HORAS + 1) * 60 * 60 * 1000);
    expect(nivelAtencao("em_execucao", abertura, inicio, null, agora)).toBe("atencao");
  });

  it("parado dentro do limite (folgado, pausa costuma ser esperada) fica ok", () => {
    const pausa = new Date(agora.getTime() - (LIMITE_PARADO_HORAS - 1) * 60 * 60 * 1000);
    expect(nivelAtencao("parado", agora, agora, pausa, agora)).toBe("ok");
  });

  it("parado além do limite vira atencao", () => {
    const pausa = new Date(agora.getTime() - (LIMITE_PARADO_HORAS + 1) * 60 * 60 * 1000);
    expect(nivelAtencao("parado", agora, agora, pausa, agora)).toBe("atencao");
  });

  it("concluido e cancelada nunca ficam em atencao", () => {
    const antiga = new Date(agora.getTime() - 999 * 60 * 60 * 1000);
    expect(nivelAtencao("concluido", antiga, antiga, null, agora)).toBe("ok");
    expect(nivelAtencao("cancelada", antiga, null, null, agora)).toBe("ok");
  });
});

describe("lotacaoGalpoes / galpaoMenosOcupado", () => {
  it("conta OS em_execucao e parado com galpão atribuído (ambos ocupam vaga física)", () => {
    const ordens: OrdemParaLotacao[] = [
      { status: "em_execucao", galpao: 1 },
      { status: "parado", galpao: 1 },
      { status: "em_execucao", galpao: 2 },
      { status: "aguardando", galpao: null },
      { status: "concluido", galpao: 3 }, // não conta mais como ocupando o galpão
    ];
    expect(lotacaoGalpoes(ordens)).toEqual({ 1: 2, 2: 1, 3: 0 });
  });

  it("sugere o galpão menos ocupado", () => {
    const ordens: OrdemParaLotacao[] = [
      { status: "em_execucao", galpao: 1 },
      { status: "em_execucao", galpao: 1 },
      { status: "em_execucao", galpao: 2 },
    ];
    const resultado = galpaoMenosOcupado(ordens);
    expect(resultado.galpao).toBe(3);
    expect(resultado.lotado).toBe(false);
  });

  it("avisa quando até o galpão menos ocupado está no limite", () => {
    const ordens: OrdemParaLotacao[] = [1, 2, 3].flatMap((galpao) =>
      Array.from({ length: CAPACIDADE_GALPAO }, () => ({
        status: "em_execucao" as const,
        galpao,
      }))
    );
    const resultado = galpaoMenosOcupado(ordens);
    expect(resultado.lotado).toBe(true);
  });
});

describe("statusPagamento", () => {
  it("sem contas ligadas = sem_cobranca", () => {
    expect(statusPagamento([])).toBe("sem_cobranca");
  });

  it("nenhuma conta liquidada = pendente", () => {
    expect(statusPagamento([{ status: "aberta" }, { status: "aberta" }])).toBe("pendente");
  });

  it("algumas liquidadas = parcial", () => {
    expect(statusPagamento([{ status: "liquidada" }, { status: "aberta" }])).toBe("parcial");
  });

  it("todas liquidadas = pago", () => {
    expect(statusPagamento([{ status: "liquidada" }, { status: "liquidada" }])).toBe("pago");
  });
});
