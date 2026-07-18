"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatarDinheiro } from "@/lib/format";
import type { PontoFluxoCaixa } from "@/modules/financeiro/data/dashboard.repository";

const formatadorEixo = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatarDiaEixo(dia: string): string {
  return `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
}

export function FluxoCaixaChart({ dados }: { dados: PontoFluxoCaixa[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={dados} barGap={2} barCategoryGap="20%">
        <CartesianGrid vertical={false} stroke="var(--border)" strokeWidth={1} />
        <XAxis
          dataKey="dia"
          tickFormatter={formatarDiaEixo}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          axisLine={{ stroke: "var(--border)" }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => formatadorEixo.format(v)}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={64}
        />
        <Tooltip
          cursor={{ fill: "var(--muted)" }}
          contentStyle={{
            background: "var(--popover)",
            color: "var(--popover-foreground)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 13,
          }}
          labelFormatter={(dia) => formatarDiaEixo(String(dia))}
          formatter={(valor, nome) => [formatarDinheiro(Number(valor)), String(nome)]}
        />
        <Legend
          formatter={(valor) => <span className="text-sm text-foreground">{valor}</span>}
        />
        <Bar
          dataKey="entradas"
          name="Entradas"
          fill="var(--color-fin-entrada)"
          radius={[4, 4, 0, 0]}
          maxBarSize={20}
        />
        <Bar
          dataKey="saidas"
          name="Saídas"
          fill="var(--color-fin-saida)"
          radius={[4, 4, 0, 0]}
          maxBarSize={20}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
