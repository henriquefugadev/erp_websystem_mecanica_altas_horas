import { createClient } from "@/lib/supabase/server";
import { hojeSaoPaulo } from "@/lib/format";
import {
  buscarFluxoCaixa,
  buscarInadimplencia,
  buscarResumo,
} from "@/modules/financeiro/data/dashboard.repository";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { KpiCards } from "@/components/financeiro/kpi-cards";
import { FluxoCaixaChart } from "@/components/financeiro/fluxo-caixa-chart";
import { InadimplenciaPanel } from "@/components/financeiro/inadimplencia-panel";

function trintaDiasAtras(hoje: string): string {
  const data = new Date(`${hoje}T00:00:00Z`);
  data.setUTCDate(data.getUTCDate() - 29);
  return data.toISOString().slice(0, 10);
}

export default async function FinanceiroDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ de?: string; ate?: string }>;
}) {
  const hoje = hojeSaoPaulo();
  const { de = trintaDiasAtras(hoje), ate = hoje } = await searchParams;

  const supabase = await createClient();
  const [resumo, fluxo, inadimplencia] = await Promise.all([
    buscarResumo(supabase, de, ate),
    buscarFluxoCaixa(supabase, de, ate),
    buscarInadimplencia(supabase),
  ]);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-heading text-2xl">Financeiro</h1>
        <form className="flex items-end gap-2">
          <div className="grid gap-1.5">
            <Label htmlFor="de">De</Label>
            <Input id="de" type="date" name="de" defaultValue={de} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ate">Até</Label>
            <Input id="ate" type="date" name="ate" defaultValue={ate} />
          </div>
          <Button type="submit" variant="outline">
            Filtrar
          </Button>
        </form>
      </div>

      {resumo && <KpiCards resumo={resumo} />}

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Fluxo de caixa</CardTitle>
        </CardHeader>
        <CardContent>
          <FluxoCaixaChart dados={fluxo} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Inadimplência</CardTitle>
        </CardHeader>
        <CardContent>
          <InadimplenciaPanel linhas={inadimplencia} />
        </CardContent>
      </Card>
    </div>
  );
}
