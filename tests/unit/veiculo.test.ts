import { describe, expect, it } from "vitest";
import { validarPlaca } from "@/lib/validators/veiculo";

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
