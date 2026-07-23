"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { pecaSchema } from "@/lib/validators/peca.schema";
import {
  pecaDefaultValues,
  type PecaFormOutput,
  type PecaFormValues,
} from "@/components/estoque/peca-form-schema";
import { PecaFields } from "@/components/estoque/peca-fields";
import { criarPecaAction } from "@/modules/estoque/application/peca.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function NovaPecaForm() {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);

  const form = useForm<PecaFormValues, unknown, PecaFormOutput>({
    resolver: zodResolver(pecaSchema),
    defaultValues: pecaDefaultValues,
  });

  async function onSubmit(dados: PecaFormValues) {
    setErro(null);
    const resultado = await criarPecaAction(dados);
    if (!resultado.ok) {
      setErro(resultado.erro);
      return;
    }
    toast.success("Peça cadastrada.");
    router.push(`/estoque/${resultado.data.id}`);
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6">
      <Card>
        <CardContent className="pt-6">
          <PecaFields register={form.register} errors={form.formState.errors} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Estoque de abertura (opcional)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="text-xs text-muted-foreground">
            Se essa peça já tem quantidade em mãos, informe abaixo — vira a primeira entrada no
            histórico dela. Deixe em branco para cadastrar com saldo zero.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="quantidadeInicial">Quantidade em estoque</Label>
              <Input
                id="quantidadeInicial"
                type="text"
                inputMode="decimal"
                {...form.register("quantidadeInicial")}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="custoInicial">Custo unitário (R$)</Label>
              <Input
                id="custoInicial"
                type="text"
                inputMode="decimal"
                {...form.register("custoInicial")}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={form.formState.isSubmitting}
          className="bg-action text-action-foreground hover:bg-action/90"
        >
          Salvar peça
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
