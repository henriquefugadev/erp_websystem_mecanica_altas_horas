"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { pecaSchema } from "@/lib/validators/peca.schema";
import type {
  PecaFormOutput,
  PecaFormValues,
} from "@/components/estoque/peca-form-schema";
import { PecaFields } from "@/components/estoque/peca-fields";
import { atualizarPecaAction } from "@/modules/estoque/application/peca.actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function EditarPecaForm({
  pecaId,
  valoresIniciais,
}: {
  pecaId: string;
  valoresIniciais: PecaFormValues;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);

  const form = useForm<PecaFormValues, unknown, PecaFormOutput>({
    resolver: zodResolver(pecaSchema),
    defaultValues: valoresIniciais,
  });

  async function onSubmit(dados: PecaFormValues) {
    setErro(null);
    const resultado = await atualizarPecaAction(pecaId, dados);
    if (!resultado.ok) {
      setErro(resultado.erro);
      return;
    }
    toast.success("Peça atualizada.");
    router.push(`/estoque/${pecaId}`);
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6">
      <Card>
        <CardContent className="pt-6">
          <PecaFields register={form.register} errors={form.formState.errors} />
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
