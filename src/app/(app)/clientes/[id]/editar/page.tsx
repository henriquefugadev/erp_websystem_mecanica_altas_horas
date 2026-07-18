import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buscarClientePorId } from "@/modules/crm/data/cliente.repository";
import type { ClienteFormValues } from "@/components/crm/cliente-form-schema";
import { EditarClienteForm } from "./editar-cliente-form";

export default async function EditarClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  let cliente;
  try {
    cliente = await buscarClientePorId(supabase, id);
  } catch {
    notFound();
  }

  const valoresIniciais: ClienteFormValues = {
    tipo: cliente.tipo,
    nome: cliente.nome,
    documento: cliente.documento,
    telefone: cliente.telefone,
    email: cliente.email ?? "",
    cep: cliente.cep,
    logradouro: cliente.logradouro,
    numero: cliente.numero,
    complemento: cliente.complemento ?? "",
    bairro: cliente.bairro,
    cidade: cliente.cidade,
    estado: cliente.estado,
    origem: cliente.origem ?? "",
    notas: cliente.notas ?? "",
    consenteEmail: cliente.consente_email,
    consenteSms: cliente.consente_sms,
  };

  return (
    <div className="grid max-w-2xl gap-6">
      <h1 className="font-heading text-2xl">Editar cliente</h1>
      <EditarClienteForm clienteId={cliente.id} valoresIniciais={valoresIniciais} />
    </div>
  );
}
