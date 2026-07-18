import { describe, expect, it } from "vitest";
import { validarCEP, validarTelefone } from "@/lib/validators/contato";

describe("validarTelefone", () => {
  it("aceita celular com DDD válido e formatos diversos", () => {
    expect(validarTelefone("(11) 91234-5678")).toBe(true);
    expect(validarTelefone("11912345678")).toBe(true);
  });

  it("aceita fixo com DDD válido", () => {
    expect(validarTelefone("(11) 2345-6789")).toBe(true);
  });

  it("rejeita DDD inexistente", () => {
    expect(validarTelefone("(01) 1234-5678")).toBe(false);
    expect(validarTelefone("0112345678")).toBe(false);
  });

  it("rejeita tamanho incorreto", () => {
    expect(validarTelefone("123")).toBe(false);
    expect(validarTelefone("119123456789")).toBe(false);
  });

  it("rejeita fixo iniciando em 9 e celular sem iniciar em 9", () => {
    expect(validarTelefone("1191234567")).toBe(false); // 10 dígitos, número começando em 9 (deveria ser celular de 11)
    expect(validarTelefone("11812345678")).toBe(false); // 11 dígitos sem iniciar em 9
  });
});

describe("validarCEP", () => {
  it("aceita CEP de 8 dígitos", () => {
    expect(validarCEP("01001-000")).toBe(true);
    expect(validarCEP("01001000")).toBe(true);
  });

  it("rejeita tamanho incorreto", () => {
    expect(validarCEP("123")).toBe(false);
  });
});
