import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buscarPecaPorId } from "@/modules/estoque/data/peca.repository";
import { listarMovimentacoesDaPeca } from "@/modules/estoque/data/movimentacao.repository";
import { nivelEstoque } from "@/modules/estoque/domain/estoque";
import { TIPO_MOVIMENTACAO_LABEL } from "@/modules/estoque/domain/types";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatarDataHora, formatarDinheiro } from "@/lib/format";
import { ExcluirPecaButton } from "./excluir-peca-button";
import { RegistrarMovimentacaoDialog } from "./registrar-movimentacao-dialog";
import { AjustarEstoqueDialog } from "./ajustar-estoque-dialog";

export default async function PecaDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  let peca;
  try {
    peca = await buscarPecaPorId(supabase, id);
  } catch {
    notFound();
  }

  const movimentacoes = await listarMovimentacoesDaPeca(supabase, id);
  const nivel = nivelEstoque(peca);

  return (
    <div className="grid max-w-3xl gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl">{peca.nome}</h1>
          <p className="text-sm text-muted-foreground">
            {peca.sku ? `SKU ${peca.sku}` : "Sem SKU"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/estoque/${peca.id}/editar`} className={buttonVariants({ variant: "outline" })}>
            Editar
          </Link>
          <ExcluirPecaButton pecaId={peca.id} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Estoque</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
          <Campo
            rotulo="Saldo atual"
            valor={`${peca.estoque_atual} ${peca.unidade}`}
            destaque={nivel !== "ok"}
          />
          <Campo rotulo="Estoque mínimo" valor={`${peca.estoque_minimo} ${peca.unidade}`} />
          <Campo rotulo="Custo médio" valor={formatarDinheiro(peca.custo_medio)} />
          <Campo rotulo="Preço de venda" valor={formatarDinheiro(peca.preco_venda)} />

          {nivel !== "ok" && (
            <div className="col-span-full">
              <Badge variant="outline" className="border-alert/30 bg-alert/10 text-alert">
                {nivel === "zerado" ? "Estoque zerado" : "Estoque abaixo do mínimo"}
              </Badge>
            </div>
          )}

          <div className="col-span-full flex flex-wrap gap-2 pt-2">
            <RegistrarMovimentacaoDialog pecaId={peca.id} tipo="entrada" unidade={peca.unidade} />
            <RegistrarMovimentacaoDialog pecaId={peca.id} tipo="devolucao" unidade={peca.unidade} />
            <RegistrarMovimentacaoDialog pecaId={peca.id} tipo="perda" unidade={peca.unidade} />
            <AjustarEstoqueDialog
              pecaId={peca.id}
              estoqueAtual={peca.estoque_atual}
              unidade={peca.unidade}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Dados do catálogo</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <Campo rotulo="Fabricante" valor={peca.fabricante ?? "—"} />
          <Campo rotulo="Aplicação" valor={peca.aplicacao ?? "—"} />
          <Campo rotulo="Localização" valor={peca.localizacao ?? "—"} />
          <Campo rotulo="Status" valor={peca.ativo ? "Ativa" : "Inativa"} />
        </CardContent>
      </Card>

      {peca.observacoes && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">Observações</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm">{peca.observacoes}</CardContent>
        </Card>
      )}

      <div>
        <h2 className="font-heading text-lg">Histórico de movimentações</h2>
        <p className="text-xs text-muted-foreground">
          Ledger imutável — cada lançamento fica registrado para sempre, sem edição.
        </p>
      </div>

      {movimentacoes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma movimentação registrada.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Quantidade</TableHead>
              <TableHead>Referência</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movimentacoes.map((mov) => (
              <TableRow key={mov.id}>
                <TableCell className="text-muted-foreground">
                  {formatarDataHora(mov.created_at)}
                </TableCell>
                <TableCell>{TIPO_MOVIMENTACAO_LABEL[mov.tipo]}</TableCell>
                <TableCell className={mov.quantidade < 0 ? "text-alert" : "text-fin-entrada"}>
                  {mov.quantidade > 0 ? "+" : ""}
                  {mov.quantidade} {peca.unidade}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {mov.ordem_servico ? `OS #${mov.ordem_servico.numero}` : (mov.observacao ?? "—")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function Campo({
  rotulo,
  valor,
  destaque = false,
}: {
  rotulo: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      <p className={destaque ? "font-medium text-alert" : ""}>{valor}</p>
    </div>
  );
}
