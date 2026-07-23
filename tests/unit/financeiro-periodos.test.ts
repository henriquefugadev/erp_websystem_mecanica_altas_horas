import { describe, expect, it } from "vitest";
import { inicioMes, inicioSemana, intervalosPadrao, saldo } from "@/modules/financeiro/application/periodos";

describe("inicioMes", () => {
  it("retorna o primeiro dia do mês corrente", () => {
    expect(inicioMes("2026-07-21")).toBe("2026-07-01");
  });

  it("funciona em janeiro (virada de ano)", () => {
    expect(inicioMes("2026-01-15")).toBe("2026-01-01");
  });
});

describe("inicioSemana", () => {
  it("retorna o próprio dia quando hoje é domingo", () => {
    expect(inicioSemana("2026-07-19")).toBe("2026-07-19");
  });

  it("retorna o domingo mais recente quando hoje é no meio da semana", () => {
    // 2026-07-21 é uma terça-feira; o domingo anterior é 2026-07-19.
    expect(inicioSemana("2026-07-21")).toBe("2026-07-19");
  });

  it("cruza a virada de mês corretamente", () => {
    // 2026-08-01 é um sábado; o domingo anterior é 2026-07-26.
    expect(inicioSemana("2026-08-01")).toBe("2026-07-26");
  });
});

describe("intervalosPadrao", () => {
  it("monta os 3 intervalos até hoje", () => {
    expect(intervalosPadrao("2026-07-21")).toEqual({
      hoje: { de: "2026-07-21", ate: "2026-07-21" },
      semana: { de: "2026-07-19", ate: "2026-07-21" },
      mes: { de: "2026-07-01", ate: "2026-07-21" },
    });
  });
});

describe("saldo", () => {
  it("calcula a diferença entre entradas e saídas", () => {
    expect(saldo(1000, 400)).toBe(600);
  });

  it("aceita valores numeric do Postgres serializados como string", () => {
    expect(saldo("1000.50", "400.25")).toBeCloseTo(600.25);
  });

  it("retorna negativo quando saiu mais do que entrou", () => {
    expect(saldo(100, 300)).toBe(-200);
  });

  it("retorna zero quando entradas e saídas se igualam", () => {
    expect(saldo(0, 0)).toBe(0);
  });
});
