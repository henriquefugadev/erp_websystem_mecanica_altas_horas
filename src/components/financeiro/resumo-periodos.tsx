import { TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatarDinheiro } from "@/lib/format";
import { saldo } from "@/modules/financeiro/application/periodos";

export interface ResumoPeriodo {
  titulo: string;
  entradas: number | string;
  saidas: number | string;
}

export function ResumoPeriodos({ periodos }: { periodos: ResumoPeriodo[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {periodos.map((periodo) => {
        const valorSaldo = saldo(periodo.entradas, periodo.saidas);

        return (
          <Card key={periodo.titulo}>
            <CardContent className="grid gap-3">
              <p className="text-sm text-muted-foreground">{periodo.titulo}</p>
              <p
                className={cn(
                  "font-heading text-3xl",
                  valorSaldo >= 0 ? "text-fin-entrada" : "text-alert"
                )}
              >
                {formatarDinheiro(valorSaldo)}
              </p>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1 text-fin-entrada">
                  <TrendingUp className="size-4" />
                  Entradas
                </span>
                <span className="text-fin-entrada">{formatarDinheiro(Number(periodo.entradas))}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1 text-fin-saida">
                  <TrendingDown className="size-4" />
                  Saídas
                </span>
                <span className="text-fin-saida">{formatarDinheiro(Number(periodo.saidas))}</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
