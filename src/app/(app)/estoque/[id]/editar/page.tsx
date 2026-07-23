import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buscarPecaPorId } from "@/modules/estoque/data/peca.repository";
import type { PecaFormValues } from "@/components/estoque/peca-form-schema";
import { EditarPecaForm } from "./editar-peca-form";

export default async function EditarPecaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  let peca;
  try {
    peca = await buscarPecaPorId(supabase, id);
  } catch {
    notFound();
  }

  const valoresIniciais: PecaFormValues = {
    sku: peca.sku ?? "",
    nome: peca.nome,
    fabricante: peca.fabricante ?? "",
    aplicacao: peca.aplicacao ?? "",
    unidade: peca.unidade,
    localizacao: peca.localizacao ?? "",
    precoVenda: peca.preco_venda,
    estoqueMinimo: peca.estoque_minimo,
    observacoes: peca.observacoes ?? "",
    ativo: peca.ativo,
    quantidadeInicial: "",
    custoInicial: "",
  };

  return (
    <div className="grid max-w-2xl gap-6">
      <h1 className="font-heading text-2xl">Editar peça</h1>
      <EditarPecaForm pecaId={peca.id} valoresIniciais={valoresIniciais} />
    </div>
  );
}
