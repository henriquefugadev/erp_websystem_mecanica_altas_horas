"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Download, FileText, Percent, Plus, Trash2 } from "lucide-react";
import type { z } from "zod";
import { diagnosticoSchema } from "@/lib/validators/diagnostico.schema";
import {
  buscarDiagnosticoAction,
  salvarDiagnosticoAction,
} from "@/modules/orcamento/application/orcamento.actions";
import { pausarOrdemAction } from "@/modules/patio/application/ordem-servico.actions";
import { aplicarMarkup, calcularTotalOrcamento } from "@/modules/orcamento/domain/calculo";
import { formatarDinheiro } from "@/lib/format";
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

const DATALIST_ID = "orcamento-pecas-catalogo";

function itemVazio(): ItemForm {
  return {
    tipo: "peca",
    descricao: "",
    quantidade: "",
    pecaId: "",
    fornecedorId: "",
    custoCotado: "",
    precoUnitario: "",
    desconto: "",
  };
}

export function OrcamentoDialog({
  ordemId,
  numero,
  status,
  pecas,
  markup,
}: {
  ordemId: string;
  numero: number;
  status: StatusOS;
  pecas: PecaOpcao[];
  markup: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [pausar, setPausar] = useState(status === "em_execucao");
  const [erro, setErro] = useState<string | null>(null);
  // Id do orçamento-rascunho: vem do carregamento (se já existe) ou do salvar.
  // Habilita o botão de PDF — só dá pra baixar depois de ter algo salvo.
  const [orcamentoId, setOrcamentoId] = useState<string | null>(null);
  const descRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [proximoFoco, setProximoFoco] = useState<number | null>(null);

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(diagnosticoSchema),
    defaultValues: { itens: [itemVazio()] },
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "itens",
  });
  // PDF reflete o que está salvo no banco: só libera quando há orçamento salvo
  // e nenhuma edição pendente. Editar depois de salvar desabilita até salvar de
  // novo, para o PDF nunca sair desatualizado do que a Michele está vendo.
  const podeBaixarPdf = orcamentoId !== null && !form.formState.isDirty && !carregando;

  // Ao abrir, carrega o rascunho já existente da OS (se houver) para editar em
  // vez de recomeçar — preços/custos já lançados voltam preenchidos.
  useEffect(() => {
    if (!open) return;
    setErro(null);
    setPausar(status === "em_execucao");
    setOrcamentoId(null);
    setCarregando(true);
    buscarDiagnosticoAction(ordemId)
      .then((rascunho) => {
        if (rascunho && rascunho.itens.length > 0) {
          setOrcamentoId(rascunho.orcamentoId);
          // reset (não replace) para as linhas carregadas virarem o estado
          // "limpo" — assim o botão de PDF já nasce liberado e só desabilita se
          // ela editar algo.
          form.reset({
            itens: rascunho.itens.map((i) => ({
              tipo: i.tipo,
              descricao: i.descricao,
              quantidade: String(i.quantidade),
              pecaId: i.pecaId ?? "",
              fornecedorId: i.fornecedorId ?? "",
              custoCotado: i.custoCotado != null ? String(i.custoCotado) : "",
              precoUnitario: i.precoUnitario ? String(i.precoUnitario) : "",
              desconto: i.desconto ? String(i.desconto) : "",
            })),
          });
        } else {
          form.reset({ itens: [itemVazio()] });
        }
      })
      .finally(() => setCarregando(false));
  }, [open, ordemId, status, form]);

  // Foca a descrição da linha recém-adicionada (Enter ou botão).
  useEffect(() => {
    if (proximoFoco === null) return;
    descRefs.current[proximoFoco]?.focus();
    setProximoFoco(null);
  }, [proximoFoco, fields.length]);

  const itensAtuais = form.watch("itens");
  const totalAoVivo = calcularTotalOrcamento(
    (itensAtuais ?? []).map((item) => ({
      quantidade: Number(item.quantidade) || 0,
      precoUnitario: Number(item.precoUnitario) || 0,
      desconto: Number(item.desconto) || 0,
    }))
  );

  function adicionarLinha() {
    append(itemVazio());
    setProximoFoco(fields.length);
  }

  function onUltimoCampoKeyDown(e: KeyboardEvent<HTMLInputElement>, index: number) {
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

  // Preenche o preço a partir do custo × markup da oficina, nas linhas que já
  // têm custo. O preço continua editável — é só um ponto de partida.
  function aplicarMarkupTodos() {
    let aplicados = 0;
    form.getValues("itens").forEach((item, index) => {
      const custo = Number(item.custoCotado);
      if (item.custoCotado !== "" && custo > 0) {
        form.setValue(`itens.${index}.precoUnitario`, String(aplicarMarkup(custo, markup)));
        aplicados++;
      }
    });
    if (aplicados === 0) toast.info("Nenhuma linha com custo para aplicar o markup.");
    else toast.success(`Markup de ${markup}% aplicado em ${aplicados} item(ns).`);
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
      setOrcamentoId(resultado.data.orcamentoId);
      // Marca o estado atual como "salvo" (limpa o dirty) para liberar o PDF.
      form.reset(form.getValues());
      if (pausar && status === "em_execucao") {
        await pausarOrdemAction(ordemId, "aguardando_aprovacao");
      }
      toast.success("Orçamento salvo. Baixe o PDF para enviar ao cliente.");
      router.refresh();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <FileText className="size-4" />
        Orçamento
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Orçamento da OS #{numero}</DialogTitle>
        </DialogHeader>

        <datalist id={DATALIST_ID}>
          {pecas.map((p) => (
            <option key={p.id} value={p.nome} />
          ))}
        </datalist>

        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3">
          <p className="text-xs text-muted-foreground">
            Monte a lista completa com preço. Custo é opcional — serve para calcular a margem e a
            compra por fornecedor. O PDF sai só com descrição, quantidade e preço.
          </p>

          {carregando ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Carregando...</p>
          ) : (
            fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-12 items-end gap-2">
                <div className="col-span-2 grid gap-1.5">
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
                <div className="col-span-3 grid gap-1.5">
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
                <div className="col-span-1 grid gap-1.5">
                  {index === 0 && <Label required>Qtd.</Label>}
                  <Input
                    type="text"
                    inputMode="decimal"
                    {...form.register(`itens.${index}.quantidade`)}
                  />
                </div>
                <div className="col-span-2 grid gap-1.5">
                  {index === 0 && <Label>Custo</Label>}
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="—"
                    {...form.register(`itens.${index}.custoCotado`)}
                  />
                </div>
                <div className="col-span-2 grid gap-1.5">
                  {index === 0 && <Label required>Preço</Label>}
                  <Input
                    type="text"
                    inputMode="decimal"
                    {...form.register(`itens.${index}.precoUnitario`)}
                  />
                </div>
                <div className="col-span-1 grid gap-1.5">
                  {index === 0 && <Label>Desc.</Label>}
                  <Input
                    type="text"
                    inputMode="decimal"
                    {...form.register(`itens.${index}.desconto`)}
                    onKeyDown={(e) => onUltimoCampoKeyDown(e, index)}
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

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={adicionarLinha}>
                <Plus className="size-4" />
                Adicionar item
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={aplicarMarkupTodos}>
                <Percent className="size-4" />
                Aplicar markup ({markup}%)
              </Button>
            </div>
            <p className="text-right text-base font-medium">
              Total: {formatarDinheiro(totalAoVivo)}
            </p>
          </div>

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

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            {podeBaixarPdf ? (
              <Button
                type="button"
                variant="outline"
                render={<a href={`/api/orcamentos/${orcamentoId}/pdf`} target="_blank" />}
              >
                <Download className="size-4" />
                Baixar PDF
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                disabled
                title="Salve o orçamento para liberar o PDF"
              >
                <Download className="size-4" />
                Baixar PDF
              </Button>
            )}
            <Button
              type="submit"
              disabled={enviando || carregando}
              className="bg-action text-action-foreground hover:bg-action/90"
            >
              Salvar orçamento
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
