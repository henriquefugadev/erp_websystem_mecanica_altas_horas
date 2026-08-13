"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { contaSchema } from "@/lib/validators/financeiro.schema";
import {
  contaDefaultValues,
  type ContaFormOutput,
  type ContaFormValues,
} from "@/components/financeiro/conta-form-schema";
import { ContaFields } from "@/components/financeiro/conta-fields";
import { ParcelasEditor } from "@/components/financeiro/parcelas-editor";
import { criarContaAction } from "@/modules/financeiro/application/conta.actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Erro } from "@/components/ui/erro";

interface Opcao {
  id: string;
  nome: string;
}

export function NovaContaForm({
  tipoInicial,
  categoriasReceita,
  categoriasDespesa,
  clientes,
}: {
  tipoInicial: "receber" | "pagar";
  categoriasReceita: Opcao[];
  categoriasDespesa: Opcao[];
  clientes: Opcao[];
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const form = useForm<ContaFormValues, unknown, ContaFormOutput>({
    resolver: zodResolver(contaSchema),
    defaultValues: contaDefaultValues(tipoInicial),
  });

  async function onSubmit(dados: ContaFormOutput) {
    setErro(null);
    setEnviando(true);
    try {
      const resultado = await criarContaAction(dados);
      if (!resultado.ok) {
        setErro(resultado.erro);
        return;
      }
      toast.success("Conta cadastrada.");
      router.push(`/financeiro/contas/${resultado.data.id}`);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Dados da conta</CardTitle>
        </CardHeader>
        <CardContent>
          <ContaFields
            register={form.register}
            control={form.control}
            errors={form.formState.errors}
            watch={form.watch}
            categoriasReceita={categoriasReceita}
            categoriasDespesa={categoriasDespesa}
            clientes={clientes}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Parcelamento</CardTitle>
        </CardHeader>
        <CardContent>
          <ParcelasEditor
            control={form.control}
            register={form.register}
            errors={form.formState.errors}
          />
        </CardContent>
      </Card>

      <Erro msg={erro} />

      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={enviando}
          className="bg-action text-action-foreground hover:bg-action/90"
        >
          Salvar conta
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
