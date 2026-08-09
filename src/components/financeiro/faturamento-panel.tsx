import { Package, Wrench } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatarDinheiro } from "@/lib/format";
import type { FaturamentoResumo } from "@/modules/financeiro/domain/faturamento";

// Faturamento do período separado em peças e mão de obra/serviço — o que a
// oficina mais quer enxergar (de onde vem o dinheiro). Base: contas a receber
// emitidas no período, agrupadas por categoria de receita.
export function FaturamentoPanel({ faturamento }: { faturamento: FaturamentoResumo }) {
  const { pecas, servicos, total } = faturamento;
  const pctPecas = total > 0 ? Math.round((pecas / total) * 100) : 0;
  const pctServicos = total > 0 ? 100 - pctPecas : 0;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Card>
        <CardContent className="grid gap-2">
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Package className="size-4" />
            Peças
          </p>
          <p className="font-heading text-3xl text-fin-entrada">{formatarDinheiro(pecas)}</p>
          <p className="text-xs text-muted-foreground">{pctPecas}% do faturamento</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-2">
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Wrench className="size-4" />
            Mão de obra / serviço
          </p>
          <p className="font-heading text-3xl text-fin-entrada">{formatarDinheiro(servicos)}</p>
          <p className="text-xs text-muted-foreground">{pctServicos}% do faturamento</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-2">
          <p className="text-sm text-muted-foreground">Faturamento total</p>
          <p className="font-heading text-3xl">{formatarDinheiro(total)}</p>
          <p className="text-xs text-muted-foreground">Peças + mão de obra no período</p>
        </CardContent>
      </Card>
    </div>
  );
}
