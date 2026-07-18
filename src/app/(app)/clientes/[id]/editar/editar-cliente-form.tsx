"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { clienteSchema } from "@/lib/validators/cliente.schema";
import type {
  ClienteFormOutput,
  ClienteFormValues,
} from "@/components/crm/cliente-form-schema";
import { ClienteFields } from "@/components/crm/cliente-fields";
import { atualizarClienteAction } from "@/modules/crm/application/cliente.actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function EditarClienteForm({
  clienteId,
  valoresIniciais,
}: {
  clienteId: string;
  valoresIniciais: ClienteFormValues;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);

  const form = useForm<ClienteFormValues, unknown, ClienteFormOutput>({
    resolver: zodResolver(clienteSchema),
    defaultValues: valoresIniciais,
  });

  async function onSubmit(dados: ClienteFormValues) {
    setErro(null);
    const resultado = await atualizarClienteAction(clienteId, dados);
    if (!resultado.ok) {
      setErro(resultado.erro);
      return;
    }
    toast.success("Cliente atualizado.");
    router.push(`/clientes/${clienteId}`);
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6">
      <Card>
        <CardContent className="pt-6">
          <ClienteFields
            register={form.register}
            errors={form.formState.errors}
            control={form.control}
          />
        </CardContent>
      </Card>

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={form.formState.isSubmitting}
          className="bg-action text-action-foreground hover:bg-action/90"
        >
          Salvar alterações
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
