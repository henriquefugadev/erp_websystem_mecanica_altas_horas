export function formatarDocumento(digitos: string): string {
  if (digitos.length === 11) {
    return digitos.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (digitos.length === 14) {
    return digitos.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return digitos;
}

export function formatarTelefone(digitos: string): string {
  if (digitos.length === 11) {
    return digitos.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  }
  if (digitos.length === 10) {
    return digitos.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  }
  return digitos;
}

export function formatarCEP(digitos: string): string {
  if (digitos.length === 8) {
    return digitos.replace(/(\d{5})(\d{3})/, "$1-$2");
  }
  return digitos;
}

export function formatarPlaca(placa: string): string {
  const normalizada = placa.toUpperCase();
  if (/^[A-Z]{3}[0-9]{4}$/.test(normalizada)) {
    return normalizada.replace(/([A-Z]{3})([0-9]{4})/, "$1-$2");
  }
  return normalizada;
}
