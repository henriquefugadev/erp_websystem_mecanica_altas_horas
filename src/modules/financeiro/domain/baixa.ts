import type { StatusFinanceiro } from "@/lib/supabase/database.types";

/**
 * Regras de baixa/estorno/parcelamento do financeiro, isoladas do banco
 * para serem testáveis puramente. Trabalha sempre em centavos inteiros
 * (nunca float) — mesma regra aplicada em app.registrar_pagamento no
 * banco (supabase/migrations/0002_financeiro.sql), fonte da verdade em
 * produção; estas funções espelham o cálculo para uso na UI/testes.
 */

export function reaisParaCentavos(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100);
}

export function centavosParaReais(centavos: number): number {
  return centavos / 100;
}

export function saldoParcelaCentavos(
  valorCentavos: number,
  valorPagoCentavos: number,
  descontoCentavos: number
): number {
  return valorCentavos - valorPagoCentavos - descontoCentavos;
}

export type ResultadoValidacao = { ok: true } | { ok: false; erro: string };

export function validarPagamento(
  saldoCentavos: number,
  valorCentavos: number,
  descontoCentavos: number
): ResultadoValidacao {
  if (valorCentavos <= 0) {
    return { ok: false, erro: "O valor pago deve ser maior que zero." };
  }
  if (descontoCentavos < 0) {
    return { ok: false, erro: "O desconto não pode ser negativo." };
  }
  if (valorCentavos + descontoCentavos > saldoCentavos) {
    return {
      ok: false,
      erro: `Pagamento excede o saldo em aberto de ${centavosParaReais(saldoCentavos).toFixed(2)}.`,
    };
  }
  return { ok: true };
}

export function statusParcela(
  valorCentavos: number,
  valorPagoCentavos: number,
  descontoCentavos: number
): StatusFinanceiro {
  const quitado = valorPagoCentavos + descontoCentavos;
  if (quitado >= valorCentavos) return "liquidada";
  if (quitado > 0) return "parcial";
  return "aberta";
}

export function parcelaVencida(
  status: StatusFinanceiro,
  vencimento: Date,
  hoje: Date
): boolean {
  if (status !== "aberta" && status !== "parcial") return false;
  return dataApenas(vencimento) < dataApenas(hoje);
}

export function statusExibicaoParcela(
  status: StatusFinanceiro,
  vencimento: Date,
  hoje: Date
): StatusFinanceiro | "vencida" {
  return parcelaVencida(status, vencimento, hoje) ? "vencida" : status;
}

export function statusConta(statusParcelas: StatusFinanceiro[]): StatusFinanceiro {
  if (statusParcelas.length === 0) return "aberta";
  const totalLiquidadas = statusParcelas.filter((s) => s === "liquidada").length;
  const paradas = statusParcelas.filter((s) => s === "parcial" || s === "liquidada").length;
  if (totalLiquidadas === statusParcelas.length) return "liquidada";
  if (paradas > 0) return "parcial";
  return "aberta";
}

export interface ParcelaGerada {
  numero: number;
  valorCentavos: number;
  vencimento: Date;
}

/**
 * Divide o valor total em N parcelas de centavos inteiros. A sobra de
 * arredondamento (quando o total não é múltiplo do número de parcelas)
 * é jogada na primeira parcela, mantendo soma(parcelas) === total.
 */
export function gerarParcelas(
  valorTotalCentavos: number,
  numParcelas: number,
  primeiraVencimento: Date,
  intervaloDias: number
): ParcelaGerada[] {
  if (numParcelas <= 0) {
    throw new Error("Número de parcelas deve ser maior que zero.");
  }

  const valorBase = Math.floor(valorTotalCentavos / numParcelas);
  const resto = valorTotalCentavos - valorBase * numParcelas;

  return Array.from({ length: numParcelas }, (_, i) => ({
    numero: i + 1,
    valorCentavos: i === 0 ? valorBase + resto : valorBase,
    vencimento: adicionarDias(primeiraVencimento, i * intervaloDias),
  }));
}

function dataApenas(data: Date): number {
  return Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate());
}

function adicionarDias(data: Date, dias: number): Date {
  const resultado = new Date(data);
  resultado.setUTCDate(resultado.getUTCDate() + dias);
  return resultado;
}
