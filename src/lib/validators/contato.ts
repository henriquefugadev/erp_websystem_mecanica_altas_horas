const DDDS_VALIDOS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, // SP
  21, 22, 24, // RJ
  27, 28, // ES
  31, 32, 33, 34, 35, 37, 38, // MG
  41, 42, 43, 44, 45, 46, // PR
  47, 48, 49, // SC
  51, 53, 54, 55, // RS
  61, // DF
  62, 64, // GO
  63, // TO
  65, 66, // MT
  67, // MS
  68, // AC
  69, // RO
  71, 73, 74, 75, 77, // BA
  79, // SE
  81, 87, // PE
  82, // AL
  83, // PB
  84, // RN
  85, 88, // CE
  86, 89, // PI
  91, 93, 94, // PA
  92, 97, // AM
  95, // RR
  96, // AP
  98, 99, // MA
]);

export function normalizarTelefone(valor: string): string {
  return valor.replace(/\D/g, "");
}

export function validarTelefone(valor: string): boolean {
  const telefone = normalizarTelefone(valor);
  if (telefone.length !== 10 && telefone.length !== 11) return false;

  const ddd = Number(telefone.slice(0, 2));
  if (!DDDS_VALIDOS.has(ddd)) return false;

  const numero = telefone.slice(2);
  if (telefone.length === 11) {
    // celular: 9 dígitos, sempre iniciando em 9.
    return numero[0] === "9";
  }
  // fixo: 8 dígitos, não inicia em 9.
  return numero[0] !== "9";
}

export function normalizarCEP(valor: string): string {
  return valor.replace(/\D/g, "");
}

export function validarCEP(valor: string): boolean {
  return /^\d{8}$/.test(normalizarCEP(valor));
}
