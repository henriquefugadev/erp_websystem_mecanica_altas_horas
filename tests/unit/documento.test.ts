import { describe, expect, it } from "vitest";
import { validarCNPJ, validarCPF, validarDocumento } from "@/lib/validators/documento";

describe("validarCPF", () => {
  it("aceita CPFs válidos", () => {
    expect(validarCPF("111.444.777-35")).toBe(true);
    expect(validarCPF("52998224725")).toBe(true);
  });

  it("rejeita dígito verificador incorreto", () => {
    expect(validarCPF("111.444.777-36")).toBe(false);
  });

  it("rejeita sequências triviais", () => {
    expect(validarCPF("00000000000")).toBe(false);
    expect(validarCPF("11111111111")).toBe(false);
  });

  it("rejeita tamanho incorreto", () => {
    expect(validarCPF("123456")).toBe(false);
  });
});

describe("validarCNPJ", () => {
  it("aceita CNPJs válidos", () => {
    expect(validarCNPJ("11.222.333/0001-81")).toBe(true);
  });

  it("rejeita dígito verificador incorreto", () => {
    expect(validarCNPJ("11.222.333/0001-82")).toBe(false);
  });

  it("rejeita sequências triviais", () => {
    expect(validarCNPJ("00000000000000")).toBe(false);
  });
});

describe("validarDocumento", () => {
  it("delega para CPF ou CNPJ conforme o tipo", () => {
    expect(validarDocumento("PF", "52998224725")).toBe(true);
    expect(validarDocumento("PJ", "11222333000181")).toBe(true);
    expect(validarDocumento("PF", "11222333000181")).toBe(false);
  });
});
