import { describe, expect, it } from "vitest";
import {
  validarChassi,
  validarPlaca,
  validarRenavam,
} from "@/lib/validators/veiculo";

describe("validarPlaca", () => {
  it("aceita placa no padrão antigo", () => {
    expect(validarPlaca("ABC1234")).toBe(true);
    expect(validarPlaca("abc-1234")).toBe(true);
  });

  it("aceita placa no padrão Mercosul", () => {
    expect(validarPlaca("ABC1D23")).toBe(true);
  });

  it("rejeita placas com formato inválido", () => {
    expect(validarPlaca("AB12345")).toBe(false);
    expect(validarPlaca("AAA-123")).toBe(false);
    expect(validarPlaca("")).toBe(false);
  });
});

describe("validarChassi", () => {
  it("aceita VIN de 17 caracteres válidos", () => {
    expect(validarChassi("9BWZZZ377VT004251")).toBe(true);
  });

  it("rejeita chassi com I, O ou Q (não usados em VIN)", () => {
    expect(validarChassi("9BWZZZO77VT004251")).toBe(false);
  });

  it("rejeita tamanho incorreto", () => {
    expect(validarChassi("123")).toBe(false);
  });
});

describe("validarRenavam", () => {
  it("aceita renavams válidos (11 dígitos)", () => {
    expect(validarRenavam("95059845976")).toBe(true);
    expect(validarRenavam("14283256656")).toBe(true);
  });

  it("rejeita dígito verificador incorreto", () => {
    expect(validarRenavam("67747331626")).toBe(false);
  });

  it("normaliza e valida renavam antigo de 9 dígitos com zeros à esquerda", () => {
    // "123456789" (9 dígitos) -> "00123456789" (11 dígitos) é válido pelo mod-11.
    expect(validarRenavam("123456789")).toBe(true);
  });
});
