import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { contarAbaixoDoMinimo, listarPecas } from "@/modules/estoque/data/peca.repository";
import { nivelEstoque } from "@/modules/estoque/domain/estoque";
import { MostrarMais } from "@/components/ui/mostrar-mais";
import { limiteDaUrl, recortar } from "@/lib/paginacao";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatarDinheiro } from "@/lib/format";
import { cn } from "@/lib/utils";

export default async function EstoquePage({
  searchParams,
}: {
  searchParams: Promise<{ mostrar?: string }>;
}) {
  const { mostrar } = await searchParams;
  const limite = limiteDaUrl(mostrar);
  const supabase = await createClient();

  // O contador do alerta é da oficina inteira, não da página visível.
  const [linhas, abaixoDoMinimo] = await Promise.all([
    listarPecas(supabase, false, limite + 1),
    contarAbaixoDoMinimo(supabase),
  ]);
  const { itens: pecas, temMais } = recortar(linhas, limite);

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

      <MostrarMais
        mostrando={pecas.length}
        temMais={temMais}
        limite={limite}
        params={{}}
        substantivo="peças"
      />
    </div>
  );
}
