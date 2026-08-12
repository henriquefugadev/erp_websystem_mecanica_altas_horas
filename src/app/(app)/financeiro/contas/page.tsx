import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listarContas } from "@/modules/financeiro/data/conta.repository";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/financeiro/status-badge";
import { MostrarMais } from "@/components/ui/mostrar-mais";
import { formatarData, formatarDinheiro } from "@/lib/format";
import { limiteDaUrl, recortar } from "@/lib/paginacao";
import type { StatusFinanceiro, TipoContaFinanceira } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

export default async function ContasPage({
  searchParams,
}: {
  searchParams: Promise<{
    tipo?: TipoContaFinanceira | "todos";
    status?: StatusFinanceiro | "todos";
    busca?: string;
    mostrar?: string;
  }>;
}) {
  const { tipo, status, busca, mostrar } = await searchParams;
  const limite = limiteDaUrl(mostrar);
  const supabase = await createClient();
  const { itens: contas, temMais } = recortar(
    await listarContas(supabase, {
      tipo: tipo === "todos" ? undefined : tipo,
      status: status === "todos" ? undefined : status,
      busca,
      limite: limite + 1,
    }),
    limite
  );

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl">Contas</h1>
        <div className="flex gap-2">
          <Link
            href="/financeiro/contas/nova?tipo=receber"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            <Plus className="size-4" />
            Conta a receber
          </Link>
          <Link
            href="/financeiro/contas/nova?tipo=pagar"
            className={cn(
              buttonVariants(),
              "bg-action text-action-foreground hover:bg-action/90"
            )}
          >
            <Plus className="size-4" />
            Conta a pagar
          </Link>
        </div>
      </div>

      <form className="flex flex-wrap items-end gap-2">
        <Input
          type="search"
          name="busca"
          placeholder="Buscar por descrição"
          defaultValue={busca}
          className="max-w-xs"
        />
        <select
          name="tipo"
          defaultValue={tipo ?? "todos"}
          className="h-8 w-40 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="todos">Todos os tipos</option>
          <option value="receber">A receber</option>
          <option value="pagar">A pagar</option>
        </select>
        <select
          name="status"
          defaultValue={status ?? "todos"}
          className="h-8 w-40 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="todos">Todos os status</option>
          <option value="aberta">Em aberto</option>
          <option value="parcial">Parcial</option>
          <option value="liquidada">Liquidada</option>
          <option value="cancelada">Cancelada</option>
        </select>
        <button type="submit" className={buttonVariants({ variant: "outline" })}>
          Filtrar
        </button>
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Descrição</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Cliente/Fornecedor</TableHead>
            <TableHead>Emissão</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contas.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                Nenhuma conta encontrada.
              </TableCell>
            </TableRow>
          )}
          {contas.map((conta) => (
            <TableRow key={conta.id}>
              <TableCell>
                <Link
                  href={`/financeiro/contas/${conta.id}`}
                  className="font-medium hover:underline"
                >
                  {conta.descricao}
                </Link>
              </TableCell>
              <TableCell>{conta.tipo === "receber" ? "A receber" : "A pagar"}</TableCell>
              <TableCell>{conta.categoria_financeira?.nome ?? "—"}</TableCell>
              <TableCell>{conta.cliente?.nome ?? conta.fornecedor_nome ?? "—"}</TableCell>
              <TableCell>{formatarData(conta.data_emissao)}</TableCell>
              <TableCell className="text-right">{formatarDinheiro(conta.valor_total)}</TableCell>
              <TableCell>
                <StatusBadge status={conta.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <MostrarMais
        mostrando={contas.length}
        temMais={temMais}
        limite={limite}
        params={{ tipo, status, busca }}
        substantivo="contas"
      />
    </div>
  );
}
