import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buscarOrcamentoPorId } from "@/modules/orcamento/data/orcamento.repository";
import { STATUS_ORCAMENTO_LABEL } from "@/modules/orcamento/domain/types";
import { calcularSubtotalItem } from "@/modules/orcamento/domain/calculo";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatarData, formatarDinheiro, formatarPlaca, formatarTelefone } from "@/lib/format";
import { OrcamentoAcoes } from "./orcamento-acoes";

export default async function OrcamentoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  let orcamento;
  try {
    orcamento = await buscarOrcamentoPorId(supabase, id);
  } catch {
    notFound();
  }

  const mostraColunaAprovado = orcamento.status_efetivo !== "rascunho";

  return (
    <div className="grid max-w-3xl gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl">Orçamento #{orcamento.numero}</h1>
          <p className="text-sm text-muted-foreground">{orcamento.cliente?.nome ?? "—"}</p>
        </div>
        <Badge variant="outline">{STATUS_ORCAMENTO_LABEL[orcamento.status_efetivo]}</Badge>
      </div>

      <OrcamentoAcoes orcamento={orcamento} />

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Dados</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <Campo rotulo="Emissão" valor={formatarData(orcamento.data_emissao)} />
          <Campo rotulo="Validade" valor={formatarData(orcamento.validade)} />
          <Campo
            rotulo="Veículo"
            valor={
              orcamento.veiculo
                ? `${orcamento.veiculo.modelo} — ${formatarPlaca(orcamento.veiculo.placa)}`
                : "—"
            }
          />
          <Campo
            rotulo="Telefone do cliente"
            valor={
              orcamento.cliente?.telefone ? formatarTelefone(orcamento.cliente.telefone) : "—"
            }
          />
          <Campo
            rotulo="Ordem de serviço"
            valor={orcamento.ordem_servico ? `OS #${orcamento.ordem_servico.numero}` : "—"}
          />
        </CardContent>
        <CardContent className="pt-0 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Queixa</p>
          <p className="whitespace-pre-wrap">{orcamento.queixa}</p>
          {orcamento.observacoes && (
            <>
              <p className="mt-2 font-medium text-foreground">Observações</p>
              <p className="whitespace-pre-wrap">{orcamento.observacoes}</p>
            </>
          )}
        </CardContent>
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
                <TableHead>Qtd.</TableHead>
                <TableHead>Preço unit.</TableHead>
                <TableHead>Desconto</TableHead>
                <TableHead>Subtotal</TableHead>
                {mostraColunaAprovado && <TableHead>Aprovado</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {orcamento.orcamento_item.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.descricao}</TableCell>
                  <TableCell>{item.quantidade}</TableCell>
                  <TableCell>{formatarDinheiro(item.preco_unitario)}</TableCell>
                  <TableCell>{formatarDinheiro(item.desconto)}</TableCell>
                  <TableCell>
                    {formatarDinheiro(
                      calcularSubtotalItem({
                        quantidade: item.quantidade,
                        precoUnitario: item.preco_unitario,
                        desconto: item.desconto,
                      })
                    )}
                  </TableCell>
                  {mostraColunaAprovado && <TableCell>{item.aprovado ? "Sim" : "Não"}</TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="mt-2 text-right text-lg font-medium">
            Total: {formatarDinheiro(orcamento.valor_total)}
          </p>
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
