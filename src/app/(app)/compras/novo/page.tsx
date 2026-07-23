import { createClient } from "@/lib/supabase/server";
import { listarFornecedores } from "@/modules/fornecedores/data/fornecedor.repository";
import { listarCategorias } from "@/modules/financeiro/data/categoria.repository";
import { NovoPedidoForm } from "./novo-pedido-form";

export default async function NovoPedidoPage() {
  const supabase = await createClient();

  const [fornecedores, categoriasDespesa, ordensResultado] = await Promise.all([
    listarFornecedores(supabase, true),
    listarCategorias(supabase, "despesa"),
    supabase
      .from("ordem_servico")
      .select("id, numero, queixa")
      .is("deleted_at", null)
      .neq("status", "cancelada")
      .order("numero", { ascending: false }),
  ]);

  return (
    <div className="grid max-w-2xl gap-6">
      <h1 className="font-heading text-2xl">Novo pedido de compra</h1>
      <NovoPedidoForm
        fornecedores={fornecedores}
        categoriasDespesa={categoriasDespesa}
        ordens={ordensResultado.data ?? []}
      />
    </div>
  );
}
