import { createClient } from "@/lib/supabase/server";
import { listarFuncionarios } from "@/modules/funcionarios/data/funcionario.repository";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FuncionarioFormDialog } from "@/components/funcionarios/funcionario-form-dialog";
import { ExcluirFuncionarioButton } from "@/components/funcionarios/excluir-funcionario-button";

export default async function FuncionariosPage() {
  const supabase = await createClient();
  const funcionarios = await listarFuncionarios(supabase);

  return (
    <div className="grid max-w-3xl gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl">Funcionários</h1>
        <FuncionarioFormDialog />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Cadastro</CardTitle>
        </CardHeader>
        <CardContent>
          {funcionarios.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum funcionário cadastrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {funcionarios.map((funcionario) => (
                  <TableRow key={funcionario.id}>
                    <TableCell>{funcionario.nome}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {funcionario.funcao || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {funcionario.telefone || funcionario.email || "—"}
                    </TableCell>
                    <TableCell>
                      {funcionario.ativo ? (
                        <Badge variant="outline">Ativo</Badge>
                      ) : (
                        <Badge variant="secondary">Inativo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <FuncionarioFormDialog funcionario={funcionario} />
                        <ExcluirFuncionarioButton funcionarioId={funcionario.id} />
                      </div>
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
