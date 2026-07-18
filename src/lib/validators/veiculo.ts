const PLACA_ANTIGA = /^[A-Z]{3}[0-9]{4}$/;
const PLACA_MERCOSUL = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;

export function normalizarPlaca(valor: string): string {
  return valor.replace(/[\s-]/g, "").toUpperCase();
}

export function validarPlaca(valor: string): boolean {
  const placa = normalizarPlaca(valor);
  return PLACA_ANTIGA.test(placa) || PLACA_MERCOSUL.test(placa);
}

export function normalizarChassi(valor: string): string {
  return valor.replace(/\s/g, "").toUpperCase();
}

export function validarChassi(valor: string): boolean {
  const chassi = normalizarChassi(valor);
  // 17 caracteres alfanuméricos; VIN não usa I, O, Q para evitar confusão com 1/0.
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(chassi);
}

export function normalizarRenavam(valor: string): string {
  const digitos = valor.replace(/\D/g, "");
  // Renavam antigo tinha 9 dígitos; normaliza com zeros à esquerda para 11.
  return digitos.length === 9 ? digitos.padStart(11, "0") : digitos;
}

export function validarRenavam(valor: string): boolean {
  const renavam = normalizarRenavam(valor);
  if (renavam.length !== 11 || /^0+$/.test(renavam)) return false;

  const base = renavam.slice(0, 10);
  const pesos = [3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const soma = base
    .split("")
    .reduce((acc, digito, i) => acc + Number(digito) * pesos[i], 0);
  const resto = (soma * 10) % 11;
  const dv = resto === 10 ? 0 : resto;

  return dv === Number(renavam[10]);
}
