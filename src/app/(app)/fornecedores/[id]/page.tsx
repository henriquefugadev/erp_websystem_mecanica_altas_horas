import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buscarFornecedorPorId } from "@/modules/fornecedores/data/fornecedor.repository";
import { listarPedidos } from "@/modules/fornecedores/data/pedido-compra.repository";
import { STATUS_PEDIDO_LABEL } from "@/modules/fornecedores/domain/types";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatarData, formatarDocumento, formatarTelefone } from "@/lib/format";
import { ExcluirFornecedorButton } from "./excluir-fornecedor-button";

export default async function FornecedorDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  let fornecedor;
  try {
    fornecedor = await buscarFornecedorPorId(supabase, id);
  } catch {
    notFound();
  }

  const pedidos = await listarPedidos(supabase, id);

  return (
    <div className="grid max-w-3xl gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl">{fornecedor.nome}</h1>
          {fornecedor.documento && (
            <p className="text-sm text-muted-foreground">{formatarDocumento(fornecedor.documento)}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Link
            href={`/fornecedores/${fornecedor.id}/editar`}
            className={buttonVariants({ variant: "outline" })}
          >
            Editar
          </Link>
          <ExcluirFornecedorButton fornecedorId={fornecedor.id} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Contato e condições</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <Campo rotulo="Contato" valor={fornecedor.contato_nome ?? "—"} />
          <Campo rotulo="Telefone" valor={fornecedor.telefone ? formatarTelefone(fornecedor.telefone) : "—"} />
          <Campo rotulo="E-mail" valor={fornecedor.email ?? "—"} />
          <Campo rotulo="Condições de pagamento" valor={fornecedor.condicoes_pagamento ?? "—"} />
          <Campo
            rotulo="Prazo de entrega"
            valor={fornecedor.prazo_entrega_dias ? `${fornecedor.prazo_entrega_dias} dias` : "—"}
          />
          <Campo rotulo="Status" valor={fornecedor.ativo ? "Ativo" : "Inativo"} />
        </CardContent>
      </Card>

      {fornecedor.observacoes && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">Observações</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm">{fornecedor.observacoes}</CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg">Pedidos de compra</h2>
        <Link href="/compras/novo" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Novo pedido
        </Link>
      </div>

      {pedidos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum pedido de compra para este fornecedor.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pedido</TableHead>
              <TableHead>Emissão</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pedidos.map((pedido) => (
              <TableRow key={pedido.id}>
                <TableCell>
                  <Link href={`/compras/${pedido.id}`} className="font-medium hover:underline">
                    #{pedido.numero}
                  </Link>
                </TableCell>
                <TableCell>{formatarData(pedido.data_emissao)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {pedido.categoria_financeira?.nome ?? "—"}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{STATUS_PEDIDO_LABEL[pedido.status]}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      <p>{valor}</p>
    </div>
  );
}
