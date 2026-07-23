import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listarFornecedores } from "@/modules/fornecedores/data/fornecedor.repository";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatarTelefone } from "@/lib/format";
import { cn } from "@/lib/utils";

export default async function FornecedoresPage() {
  const supabase = await createClient();
  const fornecedores = await listarFornecedores(supabase);

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl">Fornecedores</h1>
        <Link
          href="/fornecedores/novo"
          className={cn(buttonVariants(), "bg-action text-action-foreground hover:bg-action/90")}
        >
          <Plus className="size-4" />
          Novo fornecedor
        </Link>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Contato</TableHead>
            <TableHead>Condições</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fornecedores.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                Nenhum fornecedor cadastrado.
              </TableCell>
            </TableRow>
          )}
          {fornecedores.map((fornecedor) => (
            <TableRow key={fornecedor.id}>
              <TableCell>
                <Link href={`/fornecedores/${fornecedor.id}`} className="font-medium hover:underline">
                  {fornecedor.nome}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {fornecedor.telefone ? formatarTelefone(fornecedor.telefone) : fornecedor.email || "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {fornecedor.condicoes_pagamento || "—"}
              </TableCell>
              <TableCell>
                {fornecedor.ativo ? (
                  <Badge variant="outline">Ativo</Badge>
                ) : (
                  <Badge variant="secondary">Inativo</Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
