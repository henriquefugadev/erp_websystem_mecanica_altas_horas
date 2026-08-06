import { createClient } from "@/lib/supabase/server";
import { getSessaoAtual } from "@/lib/supabase/sessao";
import {
  contarDiagnosticoPorOs,
  listarOrdensDoQuadro,
  valoresConclusaoPorOs,
} from "@/modules/patio/data/ordem-servico.repository";
import { listarCategorias } from "@/modules/financeiro/data/categoria.repository";
import { listarFuncionarios } from "@/modules/funcionarios/data/funcionario.repository";
import { listarPecas } from "@/modules/estoque/data/peca.repository";
import { buscarConfiguracao } from "@/modules/workshop/data/workshop.repository";
import { KanbanBoard } from "./kanban-board";

export default async function PatioPage() {
  const supabase = await createClient();
  const sessao = await getSessaoAtual();

  const [ordens, categoriasReceita, funcionarios, pecas, diagnosticoPorOs, conclusaoPorOs, workshop] =
    await Promise.all([
      listarOrdensDoQuadro(supabase),
      listarCategorias(supabase, "receita"),
      listarFuncionarios(supabase, true),
      listarPecas(supabase, true),
      contarDiagnosticoPorOs(supabase),
      valoresConclusaoPorOs(supabase),
      sessao ? buscarConfiguracao(supabase, sessao.workshopId) : Promise.resolve(null),
    ]);

  return (
    <KanbanBoard
      ordens={ordens}
      categoriasReceita={categoriasReceita}
      funcionarios={funcionarios}
      pecas={pecas}
      diagnosticoPorOs={diagnosticoPorOs}
      conclusaoPorOs={conclusaoPorOs}
      condicoesPagamento={workshop?.condicoes_pagamento_padrao ?? null}
    />
  );
}
