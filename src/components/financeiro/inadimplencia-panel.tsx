import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatarData, formatarDinheiro } from "@/lib/format";
import type { LinhaInadimplencia } from "@/modules/financeiro/domain/types";

export function InadimplenciaPanel({ linhas }: { linhas: LinhaInadimplencia[] }) {
  if (linhas.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma parcela vencida em aberto. 🎉
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Descrição</TableHead>
          <TableHead>Cliente/Fornecedor</TableHead>
          <TableHead>Parcela</TableHead>
          <TableHead>Vencimento</TableHead>
          <TableHead>Dias em atraso</TableHead>
          <TableHead className="text-right">Saldo</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {linhas.map((linha) => (
          <TableRow key={linha.parcela_id}>
            <TableCell>
              <Link
                href={`/financeiro/contas/${linha.conta_id}`}
                className="font-medium hover:underline"
              >
                {linha.descricao}
              </Link>
            </TableCell>
            <TableCell>{linha.cliente_nome ?? linha.fornecedor_nome ?? "—"}</TableCell>
            <TableCell>{linha.numero}</TableCell>
            <TableCell>{formatarData(linha.vencimento)}</TableCell>
            <TableCell className="font-medium text-alert">{linha.dias_atraso}</TableCell>
            <TableCell className="text-right">{formatarDinheiro(linha.saldo)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
