const PLACA_ANTIGA = /^[A-Z]{3}[0-9]{4}$/;
const PLACA_MERCOSUL = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;

export function normalizarPlaca(valor: string): string {
  return valor.replace(/[\s-]/g, "").toUpperCase();
}

export function validarPlaca(valor: string): boolean {
  const placa = normalizarPlaca(valor);
  return PLACA_ANTIGA.test(placa) || PLACA_MERCOSUL.test(placa);
}
