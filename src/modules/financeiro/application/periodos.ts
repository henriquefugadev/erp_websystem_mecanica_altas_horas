export interface Intervalo {
  de: string;
  ate: string;
}

export interface IntervalosPadrao {
  hoje: Intervalo;
  semana: Intervalo;
  mes: Intervalo;
}

function partesData(data: string): [number, number, number] {
  const [ano, mes, dia] = data.split("-").map(Number);
  return [ano, mes - 1, dia];
}

/** Primeiro dia do mês de `hoje` (`yyyy-mm-dd`), em UTC. */
export function inicioMes(hoje: string): string {
  const [ano, mes] = partesData(hoje);
  return new Date(Date.UTC(ano, mes, 1)).toISOString().slice(0, 10);
}

/** Domingo mais recente (inclusive) antes de `hoje` — início da semana no calendário BR. */
export function inicioSemana(hoje: string): string {
  const data = new Date(Date.UTC(...partesData(hoje)));
  data.setUTCDate(data.getUTCDate() - data.getUTCDay());
  return data.toISOString().slice(0, 10);
}

/** Intervalos "até hoje" para os 3 cards do resumo: dia, semana e mês correntes. */
export function intervalosPadrao(hoje: string): IntervalosPadrao {
  return {
    hoje: { de: hoje, ate: hoje },
    semana: { de: inicioSemana(hoje), ate: hoje },
    mes: { de: inicioMes(hoje), ate: hoje },
  };
}

/** `financeiro_resumo` retorna `numeric` do Postgres, que o PostgREST serializa como string. */
export function saldo(entradas: number | string, saidas: number | string): number {
  return Number(entradas) - Number(saidas);
}
