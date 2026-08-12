import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listarPedidos } from "@/modules/fornecedores/data/pedido-compra.repository";
import { STATUS_PEDIDO_LABEL } from "@/modules/fornecedores/domain/types";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MostrarMais } from "@/components/ui/mostrar-mais";
import { formatarData } from "@/lib/format";
import { limiteDaUrl, recortar } from "@/lib/paginacao";
import { cn } from "@/lib/utils";

export default async function ComprasPage({
  searchParams,
}: {
  searchParams: Promise<{ mostrar?: string }>;
}) {
  const { mostrar } = await searchParams;
  const limite = limiteDaUrl(mostrar);
  const supabase = await createClient();
  const { itens: pedidos, temMais } = recortar(
    await listarPedidos(supabase, undefined, limite + 1),
    limite
  );

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl">Pedidos de compra</h1>
        <Link
          href="/compras/novo"
          className={cn(buttonVariants(), "bg-action text-action-foreground hover:bg-action/90")}
        >
          <Plus className="size-4" />
          Novo pedido
        </Link>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Pedido</TableHead>
            <TableHead>Fornecedor</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Emissão</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pedidos.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                Nenhum pedido de compra cadastrado.
              </TableCell>
            </TableRow>
          )}
          {pedidos.map((pedido) => (
            <TableRow key={pedido.id}>
              <TableCell>
                <Link href={`/compras/${pedido.id}`} className="font-medium hover:underline">
                  #{pedido.numero}
                </Link>
              </TableCell>
              <TableCell>{pedido.fornecedor?.nome ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground">
                {pedido.categoria_financeira?.nome ?? "—"}
              </TableCell>
              <TableCell>{formatarData(pedido.data_emissao)}</TableCell>
              <TableCell>
                <Badge variant="outline">{STATUS_PEDIDO_LABEL[pedido.status]}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <MostrarMais
        mostrando={pedidos.length}
        temMais={temMais}
        limite={limite}
        params={{}}
        substantivo="pedidos"
      />
    </div>
  );
}
