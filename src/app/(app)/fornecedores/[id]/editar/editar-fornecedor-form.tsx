"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { fornecedorSchema } from "@/lib/validators/fornecedor.schema";
import type {
  FornecedorFormOutput,
  FornecedorFormValues,
} from "@/components/fornecedores/fornecedor-form-schema";
import { FornecedorFields } from "@/components/fornecedores/fornecedor-fields";
import { atualizarFornecedorAction } from "@/modules/fornecedores/application/fornecedor.actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Erro } from "@/components/ui/erro";

export function EditarFornecedorForm({
  fornecedorId,
  valoresIniciais,
}: {
  fornecedorId: string;
  valoresIniciais: FornecedorFormValues;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);

  const form = useForm<FornecedorFormValues, unknown, FornecedorFormOutput>({
    resolver: zodResolver(fornecedorSchema),
    defaultValues: valoresIniciais,
  });

  async function onSubmit(dados: FornecedorFormValues) {
    setErro(null);
    const resultado = await atualizarFornecedorAction(fornecedorId, dados);
    if (!resultado.ok) {
      setErro(resultado.erro);
      return;
    }
    toast.success("Fornecedor atualizado.");
    router.push(`/fornecedores/${fornecedorId}`);
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6">
      <Card>
        <CardContent className="pt-6">
          <FornecedorFields register={form.register} errors={form.formState.errors} />
        </CardContent>
      </Card>

      <Erro msg={erro} />

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
