"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import type { z } from "zod";
import { revisaoConclusaoSchema } from "@/lib/validators/ordem-servico.schema";
import {
  buscarItensConclusaoAction,
  concluirOrdemAction,
} from "@/modules/patio/application/ordem-servico.actions";
import { agruparValoresPorCategoria } from "@/modules/orcamento/domain/calculo";
import { formatarDinheiro, hojeSaoPaulo } from "@/lib/format";
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

type FormValues = z.input<typeof revisaoConclusaoSchema>;
type FormOutput = z.output<typeof revisaoConclusaoSchema>;
type ItemForm = NonNullable<FormValues["itens"]>[number];

function categoriaSugerida(categoriasReceita: { id: string; nome: string }[]): string {
  const maoDeObra = categoriasReceita.find((c) => c.nome.trim().toLowerCase() === "mão de obra");
  return maoDeObra?.id ?? categoriasReceita[0]?.id ?? "";
}

function categoriaPeca(categoriasReceita: { id: string; nome: string }[], fallback: string): string {
  return categoriasReceita.find((c) => /pe[çc]a/i.test(c.nome))?.id ?? fallback;
}

function linhaVazia(categoriaId: string): ItemForm {
  return { descricao: "", categoriaId, valor: "" };
}

export function ConcluirOsDialog({
  ordemId,
  numero,
  categoriasReceita,
}: {
  ordemId: string;
  numero: number;
  categoriasReceita: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [carregando, setCarregando] = useState(false);

  const catServico = categoriaSugerida(categoriasReceita);
  const catPeca = categoriaPeca(categoriasReceita, catServico);

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(revisaoConclusaoSchema),
    defaultValues: { vencimento: hojeSaoPaulo(), itens: [linhaVazia(catServico)] },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "itens" });

  // Ao abrir, traz o orçamento aprovado da OS copiado linha a linha, para a
  // Michele só revisar (mexer se algo mudou) e fechar. Sem orçamento aprovado,
  // abre com uma linha em branco para lançar na mão.
  useEffect(() => {
    if (!open) return;
    setErro(null);
    setCarregando(true);
    buscarItensConclusaoAction(ordemId)
      .then((itens) => {
        const linhas: ItemForm[] =
          itens.length > 0
            ? itens.map((i) => ({
                descricao: i.descricao,
                categoriaId: i.tipo === "peca" ? catPeca : catServico,
                valor: String(i.valor),
              }))
            : [linhaVazia(catServico)];
        form.reset({ vencimento: hojeSaoPaulo(), itens: linhas });
      })
      .finally(() => setCarregando(false));
    // catPeca/catServico derivam de categoriasReceita (estável); form é estável.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ordemId]);

  const itensAtuais = form.watch("itens");
  const totalAoVivo = (itensAtuais ?? []).reduce((soma, i) => soma + (Number(i.valor) || 0), 0);

  async function onSubmit(dados: FormOutput) {
    setErro(null);
    setEnviando(true);
    try {
      // A revisão é por linha, mas o Financeiro gera uma conta por categoria.
      const itens = agruparValoresPorCategoria(
        dados.itens.map((i) => ({ categoriaId: i.categoriaId, valor: i.valor }))
      );
      const resultado = await concluirOrdemAction(ordemId, {
        vencimento: dados.vencimento,
        itens,
      });
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
      router.refresh();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button size="sm" className="bg-action text-action-foreground hover:bg-action/90" />}
      >
        Concluir
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Concluir OS #{numero}</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
          <div className="grid gap-2">
            <Label>Revise o orçamento antes de fechar</Label>
            <p className="text-xs text-muted-foreground">
              Isto é o que foi aprovado pelo cliente. Ajuste se algo mudou na hora do serviço.
              Cada categoria vira uma conta a receber.
            </p>

            {carregando ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Carregando...</p>
            ) : (
              fields.map((field, index) => (
                <div key={field.id} className="flex items-end gap-2">
                  <div className="grid flex-1 gap-1.5">
                    {index === 0 && <Label>Item</Label>}
                    <Input
                      placeholder="Descrição"
                      {...form.register(`itens.${index}.descricao`)}
                    />
                  </div>
                  <div className="grid w-36 gap-1.5">
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
                  <div className="grid w-24 gap-1.5">
                    {index === 0 && <Label required>Valor</Label>}
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
              ))
            )}

            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() => append(linhaVazia(catServico))}
              >
                <Plus className="size-4" />
                Adicionar item
              </Button>
              <p className="text-sm font-medium">Total: {formatarDinheiro(totalAoVivo)}</p>
            </div>

            {typeof form.formState.errors.itens?.message === "string" && (
              <Erro msg={form.formState.errors.itens.message} />
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="vencimento" required>
              Vencimento (dia em que o cliente vai pagar)
            </Label>
            <Input id="vencimento" type="date" {...form.register("vencimento")} />
            {form.formState.errors.vencimento && (
              <Erro msg={form.formState.errors.vencimento.message} />
            )}
          </div>

          {erro && <p className="text-sm text-destructive">{erro}</p>}

          <DialogFooter>
            <Button
              type="submit"
              disabled={enviando || carregando}
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
