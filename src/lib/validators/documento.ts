function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

function ehSequenciaTrivial(digitos: string): boolean {
  return /^(\d)\1*$/.test(digitos);
}

function calcularDigitoVerificador(base: string, pesos: number[]): number {
  const soma = base
    .split("")
    .reduce((acc, digito, i) => acc + Number(digito) * pesos[i], 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function validarCPF(valor: string): boolean {
  const cpf = apenasDigitos(valor);
  if (cpf.length !== 11 || ehSequenciaTrivial(cpf)) return false;

  const pesos1 = [10, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2];

  const dv1 = calcularDigitoVerificador(cpf.slice(0, 9), pesos1);
  if (dv1 !== Number(cpf[9])) return false;

  const dv2 = calcularDigitoVerificador(cpf.slice(0, 10), pesos2);
  return dv2 === Number(cpf[10]);
}

export function validarCNPJ(valor: string): boolean {
  const cnpj = apenasDigitos(valor);
  if (cnpj.length !== 14 || ehSequenciaTrivial(cnpj)) return false;

  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const dv1 = calcularDigitoVerificador(cnpj.slice(0, 12), pesos1);
  if (dv1 !== Number(cnpj[12])) return false;

  const dv2 = calcularDigitoVerificador(cnpj.slice(0, 13), pesos2);
  return dv2 === Number(cnpj[13]);
}

export function validarDocumento(tipo: "PF" | "PJ", valor: string): boolean {
  return tipo === "PF" ? validarCPF(valor) : validarCNPJ(valor);
}

export function normalizarDocumento(valor: string): string {
  return apenasDigitos(valor);
}
