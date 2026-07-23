import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buscarPedidoPorId } from "@/modules/fornecedores/data/pedido-compra.repository";
import { saldoItem, podeCancelar, podeReceber } from "@/modules/fornecedores/domain/pedido";
import { STATUS_PEDIDO_LABEL } from "@/modules/fornecedores/domain/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatarData, formatarDinheiro } from "@/lib/format";
import { ReceberPedidoDialog } from "./receber-pedido-dialog";
import { CancelarPedidoButton } from "./cancelar-pedido-button";

export default async function PedidoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  let pedido;
  try {
    pedido = await buscarPedidoPorId(supabase, id);
  } catch {
    notFound();
  }

  const itensComSaldo = pedido.pedido_compra_item.map((item) => ({
    ...item,
    saldo: saldoItem(item),
  }));
  const itensPendentes = itensComSaldo.filter((item) => item.saldo > 0);
  const totalPedido = itensComSaldo.reduce((acc, item) => acc + item.quantidade * item.preco_unitario, 0);

  return (
    <div className="grid max-w-3xl gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl">Pedido de compra #{pedido.numero}</h1>
          <p className="text-sm text-muted-foreground">{pedido.fornecedor?.nome ?? "—"}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{STATUS_PEDIDO_LABEL[pedido.status]}</Badge>
          {podeReceber(pedido.status) && (
            <ReceberPedidoDialog pedidoId={pedido.id} itensPendentes={itensPendentes} />
          )}
          {podeCancelar(pedido.status) && <CancelarPedidoButton pedidoId={pedido.id} />}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Dados do pedido</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <Campo rotulo="Categoria" valor={pedido.categoria_financeira?.nome ?? "—"} />
          <Campo rotulo="Emissão" valor={formatarData(pedido.data_emissao)} />
          <Campo
            rotulo="Previsão de entrega"
            valor={pedido.previsao_entrega ? formatarData(pedido.previsao_entrega) : "—"}
          />
          <Campo
            rotulo="Ordem de serviço"
            valor={pedido.ordem_servico ? `OS #${pedido.ordem_servico.numero}` : "—"}
          />
          <Campo rotulo="Total do pedido" valor={formatarDinheiro(totalPedido)} />
        </CardContent>
        {pedido.observacoes && (
          <CardContent className="pt-0 text-sm whitespace-pre-wrap text-muted-foreground">
            {pedido.observacoes}
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Itens</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead>Qtd. pedida</TableHead>
                <TableHead>Qtd. recebida</TableHead>
                <TableHead>Saldo</TableHead>
                <TableHead>Preço unit.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itensComSaldo.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.descricao}</TableCell>
                  <TableCell>{item.quantidade}</TableCell>
                  <TableCell>{item.quantidade_recebida}</TableCell>
                  <TableCell className={item.saldo > 0 ? "text-alert" : "text-muted-foreground"}>
                    {item.saldo}
                  </TableCell>
                  <TableCell>{formatarDinheiro(item.preco_unitario)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Recebimentos</CardTitle>
        </CardHeader>
        <CardContent>
          {pedido.recebimento_compra.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum recebimento registrado ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Observações</TableHead>
                  <TableHead>Conta a pagar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pedido.recebimento_compra.map((recebimento) => (
                  <TableRow key={recebimento.id}>
                    <TableCell>{formatarData(recebimento.data_recebimento)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {recebimento.observacoes || "—"}
                    </TableCell>
                    <TableCell>
                      {recebimento.conta_id ? (
                        <Link
                          href={`/financeiro/contas/${recebimento.conta_id}`}
                          className="hover:underline"
                        >
                          <Badge variant="outline">
                            {recebimento.conta_financeira?.status ?? "gerada"}
                          </Badge>
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
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
