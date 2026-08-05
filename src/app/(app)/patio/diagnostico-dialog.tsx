"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ClipboardList, Plus, Trash2 } from "lucide-react";
import type { z } from "zod";
import { diagnosticoSchema } from "@/lib/validators/diagnostico.schema";
import {
  buscarDiagnosticoAction,
  salvarDiagnosticoAction,
} from "@/modules/orcamento/application/orcamento.actions";
import { pausarOrdemAction } from "@/modules/patio/application/ordem-servico.actions";
import type { StatusOS } from "@/modules/patio/domain/types";
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
import type { PecaOpcao } from "./usar-peca-dialog";

type FormValues = z.input<typeof diagnosticoSchema>;
type FormOutput = z.output<typeof diagnosticoSchema>;
type ItemForm = FormValues["itens"][number];

const DATALIST_ID = "diagnostico-pecas-catalogo";

function itemVazio(): ItemForm {
  return { tipo: "peca", descricao: "", quantidade: "" };
}

export function DiagnosticoDialog({
  ordemId,
  numero,
  status,
  pecas,
}: {
  ordemId: string;
  numero: number;
  status: StatusOS;
  pecas: PecaOpcao[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [pausar, setPausar] = useState(status === "em_execucao");
  const [erro, setErro] = useState<string | null>(null);
  const descRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [proximoFoco, setProximoFoco] = useState<number | null>(null);

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(diagnosticoSchema),
    defaultValues: { itens: [itemVazio()] },
  });
  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "itens",
  });

  // Ao abrir, carrega o diagnóstico já existente da OS (se houver) para editar
  // em vez de recomeçar — os preços/cotações já lançados vêm junto e são
  // preservados no salvamento.
  useEffect(() => {
    if (!open) return;
    setErro(null);
    setPausar(status === "em_execucao");
    setCarregando(true);
    buscarDiagnosticoAction(ordemId)
      .then((rascunho) => {
        if (rascunho && rascunho.itens.length > 0) {
          replace(
            rascunho.itens.map((i) => ({
              tipo: i.tipo,
              descricao: i.descricao,
              quantidade: String(i.quantidade),
              pecaId: i.pecaId ?? "",
              fornecedorId: i.fornecedorId ?? "",
              precoUnitario: i.precoUnitario,
              desconto: i.desconto,
              custoCotado: i.custoCotado,
            }))
          );
        } else {
          replace([itemVazio()]);
        }
      })
      .finally(() => setCarregando(false));
  }, [open, ordemId, status, replace]);

  // Foca a descrição da linha recém-adicionada (Enter ou botão).
  useEffect(() => {
    if (proximoFoco === null) return;
    descRefs.current[proximoFoco]?.focus();
    setProximoFoco(null);
  }, [proximoFoco, fields.length]);

  function adicionarLinha() {
    append(itemVazio());
    setProximoFoco(fields.length);
  }

  function onQuantidadeKeyDown(e: KeyboardEvent<HTMLInputElement>, index: number) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (index === fields.length - 1) adicionarLinha();
      else descRefs.current[index + 1]?.focus();
    }
  }

  function escolherPeca(index: number, valor: string) {
    const peca = pecas.find((p) => p.nome === valor);
    form.setValue(`itens.${index}.pecaId`, peca?.id ?? "");
    if (peca) form.setValue(`itens.${index}.tipo`, "peca");
  }

  async function onSubmit(dados: FormOutput) {
    setErro(null);
    setEnviando(true);
    try {
      const resultado = await salvarDiagnosticoAction(ordemId, dados);
      if (!resultado.ok) {
        setErro(resultado.erro);
        return;
      }
      if (pausar && status === "em_execucao") {
        await pausarOrdemAction(ordemId, "aguardando_aprovacao");
      }
      toast.success("Diagnóstico salvo — rascunho de orçamento atualizado.");
      setOpen(false);
      router.refresh();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <ClipboardList className="size-4" />
        Diagnóstico
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Diagnóstico da OS #{numero}</DialogTitle>
        </DialogHeader>

        <datalist id={DATALIST_ID}>
          {pecas.map((p) => (
            <option key={p.id} value={p.nome} />
          ))}
        </datalist>

        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3">
          <p className="text-xs text-muted-foreground">
            O que os mecânicos disseram que precisa. Sem preço aqui — isso entra na cotação.
          </p>

          {carregando ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Carregando...</p>
          ) : (
            fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-12 items-end gap-2">
                <div className="col-span-3 grid gap-1.5">
                  {index === 0 && <Label>Tipo</Label>}
                  <Controller
                    name={`itens.${index}.tipo`}
                    control={form.control}
                    render={({ field: selectField }) => (
                      <Select value={selectField.value} onValueChange={selectField.onChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="peca">Peça</SelectItem>
                          <SelectItem value="servico">Serviço</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="col-span-6 grid gap-1.5">
                  {index === 0 && <Label required>Descrição</Label>}
                  <Controller
                    name={`itens.${index}.descricao`}
                    control={form.control}
                    render={({ field: descField }) => (
                      <Input
                        {...descField}
                        ref={(el) => {
                          descField.ref(el);
                          descRefs.current[index] = el;
                        }}
                        list={DATALIST_ID}
                        placeholder="Peça ou serviço"
                        onChange={(e) => {
                          descField.onChange(e);
                          escolherPeca(index, e.target.value);
                        }}
                      />
                    )}
                  />
                </div>
                <div className="col-span-2 grid gap-1.5">
                  {index === 0 && <Label required>Qtd.</Label>}
                  <Input
                    type="text"
                    inputMode="decimal"
                    {...form.register(`itens.${index}.quantidade`)}
                    onKeyDown={(e) => onQuantidadeKeyDown(e, index)}
                  />
                </div>
                <div className="col-span-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => remove(index)}
                    disabled={fields.length === 1}
                    aria-label="Remover item"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={adicionarLinha}
          >
            <Plus className="size-4" />
            Adicionar item
          </Button>

          {typeof form.formState.errors.itens?.message === "string" && (
            <p className="text-sm text-destructive">{form.formState.errors.itens.message}</p>
          )}

          {status === "em_execucao" && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={pausar}
                onChange={(e) => setPausar(e.target.checked)}
                className="size-4 accent-[var(--action)]"
              />
              Pausar a OS (aguardando aprovação do cliente)
            </label>
          )}

          {erro && <p className="text-sm text-destructive">{erro}</p>}

          <DialogFooter>
            <Button
              type="submit"
              disabled={enviando || carregando}
              className="bg-action text-action-foreground hover:bg-action/90"
            >
              Salvar diagnóstico
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
