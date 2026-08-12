import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessaoAtual } from "@/lib/supabase/sessao";
import { buscarContaPorId } from "@/modules/financeiro/data/conta.repository";
import { statusExibicaoParcela } from "@/modules/financeiro/domain/baixa";
import { FORMA_PAGAMENTO_LABEL } from "@/modules/financeiro/domain/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/financeiro/status-badge";
import { RegistrarPagamentoDialog } from "@/components/financeiro/registrar-pagamento-dialog";
import { EstornarPagamentoButton } from "@/components/financeiro/estornar-pagamento-button";
import { CancelarContaButton } from "@/components/financeiro/cancelar-conta-button";
import { ExcluirContaButton } from "@/components/financeiro/excluir-conta-button";
import { formatarData, formatarDinheiro, hojeSaoPaulo } from "@/lib/format";

export default async function ContaDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sessao = await getSessaoAtual();
  if (!sessao) notFound();

  const supabase = await createClient();
  let conta;
  try {
    conta = await buscarContaPorId(supabase, id);
  } catch {
    notFound();
  }

  const hoje = new Date(`${hojeSaoPaulo()}T00:00:00Z`);
  const parcelas = [...conta.parcela_financeira].sort((a, b) => a.numero - b.numero);
  const podeCancelar = conta.status !== "liquidada" && conta.status !== "cancelada";

  return (
    <div className="grid max-w-3xl gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-2xl">{conta.descricao}</h1>
          <p className="text-sm text-muted-foreground">
            {conta.tipo === "receber" ? "Conta a receber" : "Conta a pagar"} ·{" "}
            {conta.categoria_financeira?.nome ?? "—"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={conta.status} />
          {podeCancelar && <CancelarContaButton contaId={conta.id} />}
          {/* Excluir é do admin (a action também barra no servidor) — sem isto,
              a Michele veria um botão que sempre devolve "só o administrador". */}
          {sessao.papel === "admin" && <ExcluirContaButton contaId={conta.id} />}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Dados da conta</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <Campo
            rotulo={conta.tipo === "receber" ? "Cliente" : "Fornecedor"}
            valor={conta.cliente?.nome ?? conta.fornecedor_nome ?? "—"}
          />
          <Campo rotulo="Valor total" valor={formatarDinheiro(conta.valor_total)} />
          <Campo rotulo="Data de emissão" valor={formatarData(conta.data_emissao)} />
          <Campo rotulo="Observações" valor={conta.observacoes ?? "—"} />
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-2 font-heading text-lg">Parcelas</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nº</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-right">Pago</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {parcelas.map((parcela) => {
              const saldo = parcela.valor - parcela.valor_pago - parcela.desconto;
              const statusExibicao = statusExibicaoParcela(
                parcela.status,
                new Date(parcela.vencimento),
                hoje
              );
              const podePagar = parcela.status === "aberta" || parcela.status === "parcial";

              return (
                <TableRow key={parcela.id}>
                  <TableCell>{parcela.numero}</TableCell>
                  <TableCell>{formatarData(parcela.vencimento)}</TableCell>
                  <TableCell className="text-right">{formatarDinheiro(parcela.valor)}</TableCell>
                  <TableCell className="text-right">
                    {formatarDinheiro(parcela.valor_pago + parcela.desconto)}
                  </TableCell>
                  <TableCell className="text-right">{formatarDinheiro(saldo)}</TableCell>
                  <TableCell>
                    <StatusBadge status={statusExibicao} />
                  </TableCell>
                  <TableCell>
                    {podePagar && (
                      <RegistrarPagamentoDialog
                        parcelaId={parcela.id}
                        contaId={conta.id}
                        saldo={saldo}
                      />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div>
        <h2 className="mb-2 font-heading text-lg">Histórico de pagamentos</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Parcela</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-right">Desconto</TableHead>
              <TableHead>Forma</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {parcelas.flatMap((parcela) => parcela.pagamento_financeira).length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Nenhum pagamento registrado ainda.
                </TableCell>
              </TableRow>
            )}
            {parcelas.map((parcela) =>
              parcela.pagamento_financeira
                .slice()
                .sort((a, b) => a.data_pagamento.localeCompare(b.data_pagamento))
                .map((pagamento) => (
                  <TableRow key={pagamento.id}>
                    <TableCell>{parcela.numero}</TableCell>
                    <TableCell>{formatarData(pagamento.data_pagamento)}</TableCell>
                    <TableCell className="text-right">
                      {formatarDinheiro(pagamento.valor)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatarDinheiro(pagamento.desconto)}
                    </TableCell>
                    <TableCell>{FORMA_PAGAMENTO_LABEL[pagamento.forma_pagamento]}</TableCell>
                    <TableCell>
                      {pagamento.estornado ? (
                        <StatusBadge status="cancelada" className="text-xs" />
                      ) : (
                        <EstornarPagamentoButton
                          pagamentoId={pagamento.id}
                          contaId={conta.id}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))
            )}
          </TableBody>
        </Table>
      </div>
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
