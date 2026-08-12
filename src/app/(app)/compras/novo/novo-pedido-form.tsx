"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import type { z } from "zod";
import { pedidoCompraSchema } from "@/lib/validators/pedido-compra.schema";
import { criarPedidoAction } from "@/modules/fornecedores/application/pedido-compra.actions";
import { hojeSaoPaulo, formatarDinheiro } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Erro } from "@/components/ui/erro";

interface Opcao {
  id: string;
  nome: string;
}

interface OrdemOpcao {
  id: string;
  numero: number;
  queixa: string | null;
}

type FormValues = z.input<typeof pedidoCompraSchema>;
type FormOutput = z.output<typeof pedidoCompraSchema>;
type ItemFormValues = FormValues["itens"][number];

function itemVazio(): ItemFormValues {
  return { descricao: "", quantidade: "", precoUnitario: "" };
}

function valoresIniciais(): FormValues {
  return {
    fornecedorId: "",
    categoriaId: "",
    dataEmissao: hojeSaoPaulo(),
    previsaoEntrega: "",
    ordemServicoId: "",
    observacoes: "",
    itens: [itemVazio()],
  };
}

export function NovoPedidoForm({
  fornecedores,
  categoriasDespesa,
  ordens,
}: {
  fornecedores: Opcao[];
  categoriasDespesa: Opcao[];
  ordens: OrdemOpcao[];
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(pedidoCompraSchema),
    defaultValues: valoresIniciais(),
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "itens" });
  const itensAtuais = useWatch({ control: form.control, name: "itens" }) ?? [];

  const total = itensAtuais.reduce((acc, item) => {
    const qtd = Number(item?.quantidade) || 0;
    const preco = Number(item?.precoUnitario) || 0;
    return acc + qtd * preco;
  }, 0);

  async function onSubmit(dados: FormOutput) {
    setErro(null);
    setEnviando(true);
    try {
      const resultado = await criarPedidoAction(dados);
      if (!resultado.ok) {
        setErro(resultado.erro);
        return;
      }
      toast.success("Pedido de compra criado.");
      router.push(`/compras/${resultado.data.id}`);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Dados do pedido</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="fornecedorId" required>Fornecedor</Label>
              <Controller
                name="fornecedorId"
                control={form.control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="fornecedorId">
                      <SelectValue placeholder="Selecione">
                        {(v: string) => fornecedores.find((f) => f.id === v)?.nome ?? "Selecione"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {fornecedores.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.fornecedorId && (
                <Erro msg={form.formState.errors.fornecedorId.message} />
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="categoriaId" required>Categoria (despesa)</Label>
              <Controller
                name="categoriaId"
                control={form.control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="categoriaId">
                      <SelectValue placeholder="Selecione">
                        {(v: string) => categoriasDespesa.find((c) => c.id === v)?.nome ?? "Selecione"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {categoriasDespesa.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.categoriaId && (
                <Erro msg={form.formState.errors.categoriaId.message} />
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="dataEmissao" required>Data de emissão</Label>
              <Input id="dataEmissao" type="date" {...form.register("dataEmissao")} />
              {form.formState.errors.dataEmissao && (
                <Erro msg={form.formState.errors.dataEmissao.message} />
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="previsaoEntrega">Previsão de entrega (opcional)</Label>
              <Input id="previsaoEntrega" type="date" {...form.register("previsaoEntrega")} />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="ordemServicoId">Ordem de serviço vinculada (opcional)</Label>
            <Controller
              name="ordemServicoId"
              control={form.control}
              render={({ field }) => (
                <Select value={field.value || undefined} onValueChange={field.onChange}>
                  <SelectTrigger id="ordemServicoId">
                    <SelectValue placeholder="Nenhuma">
                      {(v: string) => {
                        const os = ordens.find((o) => o.id === v);
                        return os ? `OS #${os.numero} — ${os.queixa ?? "sem queixa"}` : "Nenhuma";
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {ordens.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        OS #{o.numero} — {o.queixa ?? "sem queixa"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="observacoes">Observações (opcional)</Label>
            <Textarea id="observacoes" rows={2} {...form.register("observacoes")} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Itens</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {fields.map((field, index) => (
            <div key={field.id} className="flex items-end gap-2">
              <div className="grid flex-1 gap-1.5">
                {index === 0 && <Label required>Descrição</Label>}
                <Input {...form.register(`itens.${index}.descricao`)} />
              </div>
              <div className="grid w-24 gap-1.5">
                {index === 0 && <Label required>Qtd.</Label>}
                <Input
                  type="text"
                  inputMode="decimal"
                  {...form.register(`itens.${index}.quantidade`)}
                />
              </div>
              <div className="grid w-32 gap-1.5">
                {index === 0 && <Label required>Preço unit. (R$)</Label>}
                <Input
                  type="text"
                  inputMode="decimal"
                  {...form.register(`itens.${index}.precoUnitario`)}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => remove(index)}
                aria-label="Remover item"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}

          <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => append(itemVazio())}>
            <Plus className="size-4" />
            Adicionar item
          </Button>

          {typeof form.formState.errors.itens?.message === "string" && (
            <Erro msg={form.formState.errors.itens.message} />
          )}

          <p className="text-sm text-muted-foreground">Total estimado: {formatarDinheiro(total)}</p>
        </CardContent>
      </Card>

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={enviando}
          className="bg-action text-action-foreground hover:bg-action/90"
        >
          Criar pedido
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

