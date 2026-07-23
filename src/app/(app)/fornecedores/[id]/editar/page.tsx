import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buscarFornecedorPorId } from "@/modules/fornecedores/data/fornecedor.repository";
import type { FornecedorFormValues } from "@/components/fornecedores/fornecedor-form-schema";
import { EditarFornecedorForm } from "./editar-fornecedor-form";

export default async function EditarFornecedorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  let fornecedor;
  try {
    fornecedor = await buscarFornecedorPorId(supabase, id);
  } catch {
    notFound();
  }

  const valoresIniciais: FornecedorFormValues = {
    nome: fornecedor.nome,
    documento: fornecedor.documento ?? "",
    telefone: fornecedor.telefone ?? "",
    email: fornecedor.email ?? "",
    contatoNome: fornecedor.contato_nome ?? "",
    condicoesPagamento: fornecedor.condicoes_pagamento ?? "",
    prazoEntregaDias: fornecedor.prazo_entrega_dias ?? "",
    observacoes: fornecedor.observacoes ?? "",
    ativo: fornecedor.ativo,
  };

  return (
    <div className="grid max-w-2xl gap-6">
      <h1 className="font-heading text-2xl">Editar fornecedor</h1>
      <EditarFornecedorForm fornecedorId={fornecedor.id} valoresIniciais={valoresIniciais} />
    </div>
  );
}
