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

const formatadorDinheiro = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatarDinheiro(valor: number): string {
  return formatadorDinheiro.format(valor);
}

const formatadorData = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** `data` no formato `yyyy-mm-dd` (coluna `date` do Postgres) ou ISO completo. */
export function formatarData(data: string): string {
  const comHorario = data.length === 10 ? `${data}T12:00:00Z` : data;
  return formatadorData.format(new Date(comHorario));
}

const formatadorDataHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** `data` em ISO completo (coluna `timestamptz`) — usado no ledger de estoque, onde vários lançamentos podem cair no mesmo dia. */
export function formatarDataHora(data: string): string {
  return formatadorDataHora.format(new Date(data));
}

const formatadorDataISO = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
});

/** Data de hoje em `America/Sao_Paulo`, no formato `yyyy-mm-dd`. */
export function hojeSaoPaulo(): string {
  return formatadorDataISO.format(new Date());
}
