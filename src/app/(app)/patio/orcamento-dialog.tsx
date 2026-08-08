"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Download, FileText, Minus, Percent, Plus, Trash2 } from "lucide-react";
import type { z } from "zod";
import { diagnosticoSchema } from "@/lib/validators/diagnostico.schema";
import {
  buscarDiagnosticoAction,
  salvarDiagnosticoAction,
} from "@/modules/orcamento/application/orcamento.actions";
import { aplicarMarkup, calcularTotalOrcamento } from "@/modules/orcamento/domain/calculo";
import type { TipoItemOrcamento } from "@/modules/orcamento/data/tipo-item.repository";
import { formatarDinheiro } from "@/lib/format";
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

// Fallback para oficinas sem tipos cadastrados ainda (Peça/Serviço, como era
// antes de a lista virar parametrizável). Ids fictícios — tipoId não é salvo.
const TIPOS_PADRAO: TipoItemOrcamento[] = [
  { id: "__peca", nome: "Peça", natureza: "peca", ativo: true, ordem: 0 },
  { id: "__servico", nome: "Serviço", natureza: "servico", ativo: true, ordem: 1 },
];

function itemVazio(tipo: TipoItemOrcamento): ItemForm {
  return {
    tipo: tipo.natureza,
    tipoId: tipo.id,
    tipoNome: tipo.nome,
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
  pecas,
  markup,
  markupHabilitado,
  tipos,
}: {
  ordemId: string;
  numero: number;
  pecas: PecaOpcao[];
  markup: number;
  markupHabilitado: boolean;
  tipos: TipoItemOrcamento[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Id do orçamento-rascunho: vem do carregamento (se já existe) ou do salvar.
  // Habilita o botão de PDF — só dá pra baixar depois de ter algo salvo.
  const [orcamentoId, setOrcamentoId] = useState<string | null>(null);
  const descRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [proximoFoco, setProximoFoco] = useState<number | null>(null);

  const tiposUsaveis = useMemo(
    () => (tipos.length > 0 ? tipos : TIPOS_PADRAO),
    [tipos]
  );
  const tipoPadrao = tiposUsaveis[0];

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(diagnosticoSchema),
    defaultValues: { itens: [itemVazio(tipoPadrao)] },
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "itens",
  });
  // PDF reflete o que está salvo no banco: só libera quando há orçamento salvo
  // e nenhuma edição pendente. Editar depois de salvar desabilita até salvar de
  // novo, para o PDF nunca sair desatualizado do que a Michele está vendo.
  const podeBaixarPdf = orcamentoId !== null && !form.formState.isDirty && !carregando;

  // Resolve qual tipo (da lista) casa com um item salvo: primeiro pelo rótulo,
  // depois pela natureza — assim um tipo renomeado/excluído ainda pré-seleciona
  // algo coerente sem perder o rótulo salvo.
  function resolverTipoId(tipoNome: string | null, natureza: "peca" | "servico"): string {
    if (tipoNome) {
      const porNome = tiposUsaveis.find(
        (t) => t.nome.toLowerCase() === tipoNome.toLowerCase()
      );
      if (porNome) return porNome.id;
    }
    return tiposUsaveis.find((t) => t.natureza === natureza)?.id ?? tipoPadrao.id;
  }

  // Ao abrir, carrega o rascunho já existente da OS (se houver) para editar em
  // vez de recomeçar — preços/custos já lançados voltam preenchidos.
  useEffect(() => {
    if (!open) return;
    setErro(null);
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
              tipoNome: i.tipoNome ?? "",
              tipoId: resolverTipoId(i.tipoNome, i.tipo),
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
          form.reset({ itens: [itemVazio(tipoPadrao)] });
        }
      })
      .finally(() => setCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ordemId]);

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
    append(itemVazio(tipoPadrao));
    setProximoFoco(fields.length);
  }

  function escolherTipo(index: number, tipoId: string) {
    const tipo = tiposUsaveis.find((t) => t.id === tipoId);
    if (!tipo) return;
    form.setValue(`itens.${index}.tipoId`, tipo.id, { shouldDirty: true });
    form.setValue(`itens.${index}.tipo`, tipo.natureza, { shouldDirty: true });
    form.setValue(`itens.${index}.tipoNome`, tipo.nome, { shouldDirty: true });
  }

  function ajustarQuantidade(index: number, delta: number) {
    const atual = Number(form.getValues(`itens.${index}.quantidade`)) || 0;
    const proximo = Math.max(0, atual + delta);
    form.setValue(`itens.${index}.quantidade`, String(proximo), {
      shouldDirty: true,
      shouldValidate: true,
    });
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
    if (peca) {
      const tipoPeca = tiposUsaveis.find((t) => t.natureza === "peca") ?? tipoPadrao;
      escolherTipo(index, tipoPeca.id);
    }
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
      <DialogContent className="sm:max-w-4xl">
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
            Monte a lista completa com preço. O custo unitário é opcional — serve para calcular a
            margem e a compra por fornecedor. O PDF sai só com descrição, quantidade e preço.
          </p>

          {carregando ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Carregando...</p>
          ) : (
            fields.map((field, index) => {
              const item = itensAtuais?.[index];
              const qtd = Number(item?.quantidade) || 0;
              const custoUnit = Number(item?.custoCotado) || 0;
              const temCusto = (item?.custoCotado ?? "") !== "" && custoUnit > 0;

              return (
                <div
                  key={field.id}
                  className="grid grid-cols-[repeat(16,minmax(0,1fr))] items-start gap-2"
                >
                  <div className="col-span-2 grid gap-1.5">
                    {index === 0 && <Label>Tipo</Label>}
                    <Controller
                      name={`itens.${index}.tipoId`}
                      control={form.control}
                      render={({ field: selectField }) => (
                        <Select
                          value={selectField.value || tipoPadrao.id}
                          onValueChange={(v) => escolherTipo(index, v ?? "")}
                        >
                          <SelectTrigger>
                            <SelectValue>
                              {(v: string) =>
                                tiposUsaveis.find((t) => t.id === v)?.nome ?? ""
                              }
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {tiposUsaveis.map((t) => (
                              <SelectItem key={t.id} value={t.id}>
                                {t.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <div className="col-span-4 grid gap-1.5">
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
                  <div className="col-span-3 grid gap-1.5">
                    {index === 0 && <Label required>Qtd.</Label>}
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        className="shrink-0"
                        onClick={() => ajustarQuantidade(index, -1)}
                        aria-label="Diminuir quantidade"
                      >
                        <Minus className="size-4" />
                      </Button>
                      <Input
                        type="text"
                        inputMode="decimal"
                        className="text-center"
                        {...form.register(`itens.${index}.quantidade`)}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        className="shrink-0"
                        onClick={() => ajustarQuantidade(index, 1)}
                        aria-label="Aumentar quantidade"
                      >
                        <Plus className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="col-span-2 grid gap-1.5">
                    {index === 0 && <Label>Custo Unitário</Label>}
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="—"
                      {...form.register(`itens.${index}.custoCotado`)}
                    />
                    {temCusto && (
                      <p className="text-xs text-muted-foreground">
                        Preço Total: {formatarDinheiro(qtd * custoUnit)}
                      </p>
                    )}
                  </div>
                  <div className="col-span-2 grid gap-1.5">
                    {index === 0 && <Label required>Preço</Label>}
                    <Input
                      type="text"
                      inputMode="decimal"
                      {...form.register(`itens.${index}.precoUnitario`)}
                    />
                  </div>
                  <div className="col-span-2 grid gap-1.5">
                    {index === 0 && <Label>Desc.</Label>}
                    <Input
                      type="text"
                      inputMode="decimal"
                      {...form.register(`itens.${index}.desconto`)}
                      onKeyDown={(e) => onUltimoCampoKeyDown(e, index)}
                    />
                  </div>
                  <div className="col-span-1 flex items-center justify-end pt-0.5">
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
              );
            })
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={adicionarLinha}>
                <Plus className="size-4" />
                Adicionar item
              </Button>
              {markupHabilitado && (
                <Button type="button" variant="outline" size="sm" onClick={aplicarMarkupTodos}>
                  <Percent className="size-4" />
                  Aplicar markup ({markup}%)
                </Button>
              )}
            </div>
            <p className="text-right text-base font-medium">
              Total: {formatarDinheiro(totalAoVivo)}
            </p>
          </div>

          {typeof form.formState.errors.itens?.message === "string" && (
            <p className="text-sm text-destructive">{form.formState.errors.itens.message}</p>
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
