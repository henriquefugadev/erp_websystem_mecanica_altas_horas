import { createClient } from "@/lib/supabase/server";
import {
  contarDiagnosticoPorOs,
  listarOrdensDoQuadro,
} from "@/modules/patio/data/ordem-servico.repository";
import { listarCategorias } from "@/modules/financeiro/data/categoria.repository";
import { listarFuncionarios } from "@/modules/funcionarios/data/funcionario.repository";
import { listarPecas } from "@/modules/estoque/data/peca.repository";
import { KanbanBoard } from "./kanban-board";

export default async function PatioPage() {
  const supabase = await createClient();

  const [ordens, categoriasReceita, funcionarios, pecas, diagnosticoPorOs] = await Promise.all([
    listarOrdensDoQuadro(supabase),
    listarCategorias(supabase, "receita"),
    listarFuncionarios(supabase, true),
    listarPecas(supabase, true),
    contarDiagnosticoPorOs(supabase),
  ]);

  return (
    <KanbanBoard
      ordens={ordens}
      categoriasReceita={categoriasReceita}
      funcionarios={funcionarios}
      pecas={pecas}
      diagnosticoPorOs={diagnosticoPorOs}
    />
  );
}
