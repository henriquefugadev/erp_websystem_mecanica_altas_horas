import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatarDinheiro } from "@/lib/format";

export interface ResumoFinanceiro {
  total_a_receber: number;
  total_a_pagar: number;
  recebido_periodo: number;
  pago_periodo: number;
  total_inadimplente: number;
}

export function KpiCards({ resumo }: { resumo: ResumoFinanceiro }) {
  const tiles = [
    { label: "A receber em aberto", valor: resumo.total_a_receber },
    { label: "A pagar em aberto", valor: resumo.total_a_pagar },
    { label: "Recebido no período", valor: resumo.recebido_periodo, tom: "entrada" as const },
    { label: "Pago no período", valor: resumo.pago_periodo, tom: "saida" as const },
    { label: "Inadimplência", valor: resumo.total_inadimplente, tom: "alerta" as const },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
      {tiles.map((tile) => (
        <Card key={tile.label}>
          <CardContent>
            <p className="text-xs text-muted-foreground">{tile.label}</p>
            <p
              className={cn(
                "mt-1 font-heading text-2xl",
                tile.tom === "entrada" && "text-fin-entrada",
                tile.tom === "saida" && "text-fin-saida",
                tile.tom === "alerta" && tile.valor > 0 && "text-alert"
              )}
            >
              {formatarDinheiro(tile.valor)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
