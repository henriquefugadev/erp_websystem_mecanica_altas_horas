import { createClient } from "@/lib/supabase/server";
import { listarOrdensDoQuadro } from "@/modules/patio/data/ordem-servico.repository";
import { listarCategorias } from "@/modules/financeiro/data/categoria.repository";
import { KanbanBoard } from "./kanban-board";

export default async function PatioPage() {
  const supabase = await createClient();

  const [ordens, categoriasReceita, clientesResultado] = await Promise.all([
    listarOrdensDoQuadro(supabase),
    listarCategorias(supabase, "receita"),
    supabase
      .from("cliente")
      .select("id, nome, veiculo(id, placa, modelo, marca)")
      .is("deleted_at", null)
      .filter("veiculo.deleted_at", "is", null)
      .order("nome"),
  ]);

  return (
    <KanbanBoard
      ordens={ordens}
      clientes={clientesResultado.data ?? []}
      categoriasReceita={categoriasReceita}
    />
  );
}
