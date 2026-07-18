import { createClient } from "@/lib/supabase/server";
import { listarCategorias } from "@/modules/financeiro/data/categoria.repository";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { CategoriaFormDialog } from "@/components/financeiro/categoria-form-dialog";
import { ExcluirCategoriaButton } from "@/components/financeiro/excluir-categoria-button";

export default async function CategoriasPage() {
  const supabase = await createClient();
  const [receitas, despesas] = await Promise.all([
    listarCategorias(supabase, "receita"),
    listarCategorias(supabase, "despesa"),
  ]);

  return (
    <div className="grid max-w-2xl gap-6">
      <h1 className="font-heading text-2xl">Categorias financeiras</h1>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-heading text-lg">Receitas</CardTitle>
          <CategoriaFormDialog tipoInicial="receita" />
        </CardHeader>
        <CardContent>
          <ListaCategorias categorias={receitas} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-heading text-lg">Despesas</CardTitle>
          <CategoriaFormDialog tipoInicial="despesa" />
        </CardHeader>
        <CardContent>
          <ListaCategorias categorias={despesas} />
        </CardContent>
      </Card>
    </div>
  );
}

function ListaCategorias({
  categorias,
}: {
  categorias: { id: string; tipo: "receita" | "despesa"; nome: string }[];
}) {
  if (categorias.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma categoria cadastrada.</p>;
  }

  return (
    <Table>
      <TableBody>
        {categorias.map((categoria) => (
          <TableRow key={categoria.id}>
            <TableCell>{categoria.nome}</TableCell>
            <TableCell className="w-20 text-right">
              <div className="flex justify-end gap-1">
                <CategoriaFormDialog categoria={categoria} />
                <ExcluirCategoriaButton categoriaId={categoria.id} />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
