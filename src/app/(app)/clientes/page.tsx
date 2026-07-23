import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listarClientes } from "@/modules/crm/data/cliente.repository";
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
import { formatarDocumento, formatarTelefone } from "@/lib/format";
import { cn } from "@/lib/utils";

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string }>;
}) {
  const { busca } = await searchParams;
  const supabase = await createClient();
  const clientes = await listarClientes(supabase, busca);

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl">Clientes</h1>
        <Link
          href="/clientes/novo"
          className={cn(
            buttonVariants(),
            "bg-action text-action-foreground hover:bg-action/90"
          )}
        >
          <Plus className="size-4" />
          Novo cliente
        </Link>
      </div>

      <form className="max-w-sm">
        <Input
          type="search"
          name="busca"
          placeholder="Buscar por nome, documento ou telefone"
          defaultValue={busca}
        />
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Documento</TableHead>
            <TableHead>Telefone</TableHead>
            <TableHead>Cidade</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clientes.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                Nenhum cliente encontrado.
              </TableCell>
            </TableRow>
          )}
          {clientes.map((cliente) => (
            <TableRow key={cliente.id}>
              <TableCell>
                <Link
                  href={`/clientes/${cliente.id}`}
                  className="font-medium hover:underline"
                >
                  {cliente.nome}
                </Link>
              </TableCell>
              <TableCell>{formatarDocumento(cliente.documento)}</TableCell>
              <TableCell>{formatarTelefone(cliente.telefone)}</TableCell>
              <TableCell>{cliente.cidade ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
