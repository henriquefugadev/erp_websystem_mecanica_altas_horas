import { redirect } from "next/navigation";
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
import { buscarParametros } from "@/modules/workshop/data/workshop.repository";
import { listarTiposItemOrcamento } from "@/modules/orcamento/data/tipo-item.repository";
import { listarServicosCatalogo } from "@/modules/servicos/data/servico-catalogo.repository";
import { KanbanBoard } from "./kanban-board";

export default async function PatioPage() {
  const sessao = await getSessaoAtual();
  if (!sessao) redirect("/login");

  const supabase = await createClient();

  // Os parâmetros decidem a janela do quadro e a categorização das contas, por
  // isso vêm antes; o resto vai tudo em paralelo.
  const { data: workshop } = await supabase
    .from("workshop")
    .select("condicoes_pagamento_padrao, markup_peca_percentual, markup_habilitado, nav_ocultos")
    .eq("id", sessao.workshopId)
    .maybeSingle();
  const parametros = await buscarParametros(supabase, sessao.workshopId);

  // Estoque desligado na sidebar = a oficina não usa peças cadastradas. Não faz
  // sentido arrastar o catálogo inteiro em toda abertura do pátio só para o
  // botão "Usar peça", que nem aparece quando a lista vem vazia.
  const usaEstoque = !(workshop?.nav_ocultos ?? []).includes("/estoque");

  const [ordens, categoriasReceita, funcionarios, pecas, diagnosticoPorOs, conclusaoPorOs, tipos, servicos] =
    await Promise.all([
      listarOrdensDoQuadro(supabase, parametros.diasOsConcluidaQuadro),
      listarCategorias(supabase, "receita"),
      listarFuncionarios(supabase, true),
      usaEstoque ? listarPecas(supabase, true) : Promise.resolve([]),
      contarDiagnosticoPorOs(supabase),
      valoresConclusaoPorOs(supabase, parametros),
      listarTiposItemOrcamento(supabase, true),
      listarServicosCatalogo(supabase, true),
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
      markup={workshop?.markup_peca_percentual ?? 30}
      markupHabilitado={workshop?.markup_habilitado ?? false}
      tipos={tipos}
      servicos={servicos}
      parametros={parametros}
    />
  );
}
