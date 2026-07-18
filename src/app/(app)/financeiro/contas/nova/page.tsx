import { createClient } from "@/lib/supabase/server";
import { listarCategorias } from "@/modules/financeiro/data/categoria.repository";
import { listarClientes } from "@/modules/crm/data/cliente.repository";
import { NovaContaForm } from "./nova-conta-form";

export default async function NovaContaPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  const { tipo } = await searchParams;
  const tipoInicial = tipo === "pagar" ? "pagar" : "receber";

  const supabase = await createClient();
  const [categoriasReceita, categoriasDespesa, clientes] = await Promise.all([
    listarCategorias(supabase, "receita"),
    listarCategorias(supabase, "despesa"),
    listarClientes(supabase),
  ]);

  return (
    <div className="grid max-w-2xl gap-6">
      <h1 className="font-heading text-2xl">
        Nova conta a {tipoInicial === "receber" ? "receber" : "pagar"}
      </h1>
      <NovaContaForm
        tipoInicial={tipoInicial}
        categoriasReceita={categoriasReceita}
        categoriasDespesa={categoriasDespesa}
        clientes={clientes}
      />
    </div>
  );
}
