import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listarPecas } from "@/modules/estoque/data/peca.repository";
import { nivelEstoque } from "@/modules/estoque/domain/estoque";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatarDinheiro } from "@/lib/format";
import { cn } from "@/lib/utils";

export default async function EstoquePage() {
  const supabase = await createClient();
  const pecas = await listarPecas(supabase);
  const abaixoDoMinimo = pecas.filter((p) => nivelEstoque(p) !== "ok").length;

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl">Estoque</h1>
          {abaixoDoMinimo > 0 && (
            <p className="text-sm text-alert">
              {abaixoDoMinimo} peça(s) abaixo do estoque mínimo.
            </p>
          )}
        </div>
        <Link
          href="/estoque/novo"
          className={cn(buttonVariants(), "bg-action text-action-foreground hover:bg-action/90")}
        >
          <Plus className="size-4" />
          Nova peça
        </Link>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Peça</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>Saldo</TableHead>
            <TableHead>Custo médio</TableHead>
            <TableHead>Preço de venda</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pecas.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                Nenhuma peça cadastrada.
              </TableCell>
            </TableRow>
          )}
          {pecas.map((peca) => {
            const nivel = nivelEstoque(peca);
            return (
              <TableRow key={peca.id}>
                <TableCell>
                  <Link href={`/estoque/${peca.id}`} className="font-medium hover:underline">
                    {peca.nome}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{peca.sku || "—"}</TableCell>
                <TableCell>
                  {nivel !== "ok" ? (
                    <Badge variant="outline" className="border-alert/30 bg-alert/10 text-alert">
                      {peca.estoque_atual} {peca.unidade}
                    </Badge>
                  ) : (
                    <span>
                      {peca.estoque_atual} {peca.unidade}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatarDinheiro(peca.custo_medio)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatarDinheiro(peca.preco_venda)}
                </TableCell>
                <TableCell>
                  {peca.ativo ? (
                    <Badge variant="outline">Ativa</Badge>
                  ) : (
                    <Badge variant="secondary">Inativa</Badge>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
