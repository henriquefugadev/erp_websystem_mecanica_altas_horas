"use client";

import dynamic from "next/dynamic";
import type { PontoFluxoCaixa } from "@/modules/financeiro/data/dashboard.repository";

const ALTURA = 280;

/**
 * O gráfico é o item mais pesado do sistema: a Recharts sozinha respondia por
 * ~113 kB do JS da rota /financeiro, que era a mais pesada do app. Ela desce em
 * um pedaço separado, depois da tela aparecer — os KPIs, o resumo por período e
 * a inadimplência (o que a oficina realmente lê primeiro) não esperam por ela.
 *
 * `ssr: false` porque o ResponsiveContainer precisa da largura real do elemento;
 * renderizar no servidor produz markup que é descartado na hidratação.
 *
 * O placeholder tem a mesma altura do gráfico para a página não pular quando
 * ele entra.
 */
const Grafico = dynamic(
  () => import("./fluxo-caixa-chart-impl").then((m) => m.FluxoCaixaChart),
  {
    ssr: false,
    loading: () => (
      <div
        style={{ height: ALTURA }}
        className="flex items-center justify-center text-sm text-muted-foreground"
      >
        Carregando o gráfico…
      </div>
    ),
  }
);

export function FluxoCaixaChart({ dados }: { dados: PontoFluxoCaixa[] }) {
  return <Grafico dados={dados} />;
}
