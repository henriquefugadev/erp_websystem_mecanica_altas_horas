import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listarOrcamentos } from "@/modules/orcamento/data/orcamento.repository";
import { STATUS_ORCAMENTO_LABEL } from "@/modules/orcamento/domain/types";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MostrarMais } from "@/components/ui/mostrar-mais";
import { formatarData, formatarDinheiro, formatarPlaca } from "@/lib/format";
import { limiteDaUrl, recortar } from "@/lib/paginacao";
import { cn } from "@/lib/utils";

export default async function OrcamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ mostrar?: string }>;
}) {
  const { mostrar } = await searchParams;
  const limite = limiteDaUrl(mostrar);
  const supabase = await createClient();
  const { itens: orcamentos, temMais } = recortar(
    await listarOrcamentos(supabase, limite + 1),
    limite
  );

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl">Orçamentos</h1>
        <Link
          href="/orcamentos/novo"
          className={cn(buttonVariants(), "bg-action text-action-foreground hover:bg-action/90")}
        >
          <Plus className="size-4" />
          Novo orçamento
        </Link>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Orçamento</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Veículo</TableHead>
            <TableHead>Validade</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orcamentos.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                Nenhum orçamento cadastrado.
              </TableCell>
            </TableRow>
          )}
          {orcamentos.map((orcamento) => (
            <TableRow key={orcamento.id}>
              <TableCell>
                <Link href={`/orcamentos/${orcamento.id}`} className="font-medium hover:underline">
                  #{orcamento.numero}
                </Link>
              </TableCell>
              <TableCell>{orcamento.cliente?.nome ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground">
                {orcamento.veiculo
                  ? `${orcamento.veiculo.modelo} — ${formatarPlaca(orcamento.veiculo.placa)}`
                  : "—"}
              </TableCell>
              <TableCell>{formatarData(orcamento.validade)}</TableCell>
              <TableCell>{formatarDinheiro(orcamento.valor_total)}</TableCell>
              <TableCell>
                <Badge variant="outline">{STATUS_ORCAMENTO_LABEL[orcamento.status_efetivo]}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <MostrarMais
        mostrando={orcamentos.length}
        temMais={temMais}
        limite={limite}
        params={{}}
        substantivo="orçamentos"
      />
    </div>
  );
}
