"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import type { z } from "zod";
import { concluirOrdemSchema } from "@/lib/validators/ordem-servico.schema";
import { concluirOrdemAction } from "@/modules/patio/application/ordem-servico.actions";
import { hojeSaoPaulo } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ConcluirFormValues = z.input<typeof concluirOrdemSchema>;
type ConcluirFormOutput = z.output<typeof concluirOrdemSchema>;

function categoriaSugerida(categoriasReceita: { id: string; nome: string }[]): string {
  const maoDeObra = categoriasReceita.find((c) => c.nome.trim().toLowerCase() === "mão de obra");
  return maoDeObra?.id ?? categoriasReceita[0]?.id ?? "";
}

function categoriaPeca(categoriasReceita: { id: string; nome: string }[], fallback: string): string {
  return categoriasReceita.find((c) => /pe[çc]a/i.test(c.nome))?.id ?? fallback;
}

export interface ValoresConclusao {
  pecas: number;
  servicos: number;
}

// Pré-preenche a cobrança a partir do orçamento aprovado: serviços na categoria
// de mão de obra, peças na categoria de peças. Sem orçamento (ou tudo zero),
// abre com uma linha em branco como antes.
function valoresIniciais(
  categoriasReceita: { id: string; nome: string }[],
  preenchidos?: ValoresConclusao
): ConcluirFormValues {
  const catServico = categoriaSugerida(categoriasReceita);
  const catPeca = categoriaPeca(categoriasReceita, catServico);

  const itens: ConcluirFormValues["itens"] = [];
  if (preenchidos) {
    if (preenchidos.servicos > 0) {
      itens.push({ categoriaId: catServico, valor: String(preenchidos.servicos) });
    }
    if (preenchidos.pecas > 0) {
      itens.push({ categoriaId: catPeca, valor: String(preenchidos.pecas) });
    }
  }
  if (itens.length === 0) itens.push({ categoriaId: catServico, valor: "" });

  return { vencimento: hojeSaoPaulo(), itens };
}

export function ConcluirOsDialog({
  ordemId,
  numero,
  categoriasReceita,
  valoresPreenchidos,
}: {
  ordemId: string;
  numero: number;
  categoriasReceita: { id: string; nome: string }[];
  valoresPreenchidos?: ValoresConclusao;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const form = useForm<ConcluirFormValues, unknown, ConcluirFormOutput>({
    resolver: zodResolver(concluirOrdemSchema),
    defaultValues: valoresIniciais(categoriasReceita, valoresPreenchidos),
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "itens" });

  async function onSubmit(dados: ConcluirFormOutput) {
    setErro(null);
    setEnviando(true);
    try {
      const resultado = await concluirOrdemAction(ordemId, dados);
      if (!resultado.ok) {
        setErro(resultado.erro);
        return;
      }
      toast.success(
        resultado.data.contaIds.length > 0
          ? `OS concluída — ${resultado.data.contaIds.length} conta(s) a receber gerada(s) no Financeiro.`
          : "OS concluída."
      );
      setOpen(false);
      form.reset(valoresIniciais(categoriasReceita, valoresPreenchidos));
      router.refresh();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) {
          setErro(null);
          form.reset(valoresIniciais(categoriasReceita, valoresPreenchidos));
        }
      }}
    >
      <DialogTrigger
        render={<Button size="sm" className="bg-action text-action-foreground hover:bg-action/90" />}
      >
        Concluir
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Concluir OS #{numero}</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
          <div className="grid gap-2">
            <Label>Itens a cobrar</Label>
            <p className="text-xs text-muted-foreground">
              Separe por categoria (ex.: mão de obra, peças). Sem itens = concluir sem gerar
              cobrança agora.
            </p>

            {fields.map((field, index) => (
              <div key={field.id} className="flex items-end gap-2">
                <div className="grid flex-1 gap-1.5">
                  {index === 0 && <Label required>Categoria</Label>}
                  <Controller
                    name={`itens.${index}.categoriaId`}
                    control={form.control}
                    render={({ field: selectField }) => (
                      <Select value={selectField.value} onValueChange={selectField.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione">
                            {(v: string) =>
                              categoriasReceita.find((c) => c.id === v)?.nome ?? "Selecione"
                            }
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {categoriasReceita.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="grid w-32 gap-1.5">
                  {index === 0 && <Label required>Valor (R$)</Label>}
                  <Input
                    type="text"
                    inputMode="decimal"
                    {...form.register(`itens.${index}.valor`)}
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

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => append({ categoriaId: categoriaSugerida(categoriasReceita), valor: "" })}
            >
              <Plus className="size-4" />
              Adicionar item
            </Button>

            {typeof form.formState.errors.itens?.message === "string" && (
              <Erro msg={form.formState.errors.itens.message} />
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="vencimento" required>Vencimento</Label>
            <Input id="vencimento" type="date" {...form.register("vencimento")} />
            {form.formState.errors.vencimento && (
              <Erro msg={form.formState.errors.vencimento.message} />
            )}
          </div>

          {erro && <p className="text-sm text-destructive">{erro}</p>}

          <DialogFooter>
            <Button
              type="submit"
              disabled={enviando}
              className="bg-action text-action-foreground hover:bg-action/90"
            >
              Concluir OS
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Erro({ msg }: { msg?: string }) {
  return <p className="text-sm text-destructive">{msg}</p>;
}
