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
import { enviarConfirmacaoAction } from "@/modules/patio/application/ordem-servico.actions";
import type { StatusOS } from "@/lib/supabase/database.types";
import {
  aplicarMarkup,
  totalDaLinhaParaUnitario,
  unitarioParaTotalDaLinha,
} from "@/modules/orcamento/domain/calculo";
import type { TipoItemOrcamento } from "@/modules/orcamento/data/tipo-item.repository";
import type { ServicoCatalogo } from "@/modules/servicos/data/servico-catalogo.repository";
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

// Fallback para oficinas sem tipos cadastrados ainda (Peça/Serviço, como era
// antes de a lista virar parametrizável). Ids fictícios — tipoId não é salvo.
const TIPOS_PADRAO: TipoItemOrcamento[] = [
  { id: "__peca", nome: "Peça", natureza: "peca", ativo: true, ordem: 0 },
  { id: "__servico", nome: "Serviço", natureza: "servico", ativo: true, ordem: 1 },
];

function arredondarCentavos(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

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
  statusOs,
  pecas,
  markup,
  markupHabilitado,
  tipos,
  servicos,
  open,
  onOpenChange,
}: {
  ordemId: string;
  numero: number;
  statusOs: StatusOS;
  pecas: PecaOpcao[];
  markup: number;
  markupHabilitado: boolean;
  tipos: TipoItemOrcamento[];
  servicos: ServicoCatalogo[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  // Id do datalist é por OS: vários cards podem ter o dialog na árvore, e id
  // repetido faria todos os campos apontarem para o primeiro datalist do DOM.
  const datalistId = `orcamento-catalogo-${ordemId}`;
  const [openInterno, setOpenInterno] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Id do orçamento-rascunho: vem do carregamento (se já existe) ou do salvar.
  // Habilita o botão de PDF — só dá pra baixar depois de ter algo salvo.
  const [orcamentoId, setOrcamentoId] = useState<string | null>(null);
  const descRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [proximoFoco, setProximoFoco] = useState<number | null>(null);
  const dialogAberto = open ?? openInterno;
  const setDialogAberto = onOpenChange ?? setOpenInterno;

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
    if (!dialogAberto) return;
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
              // Unitário salvo → total da linha para exibir no campo "Preço".
              precoUnitario: i.precoUnitario
                ? String(unitarioParaTotalDaLinha(i.precoUnitario, Number(i.quantidade)))
                : "",
              desconto: i.desconto ? String(i.desconto) : "",
            })),
          });
        } else {
          form.reset({ itens: [itemVazio(tipoPadrao)] });
        }
      })
      .finally(() => setCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogAberto, ordemId]);

  // Foca a descrição da linha recém-adicionada (Enter ou botão).
  useEffect(() => {
    if (proximoFoco === null) return;
    descRefs.current[proximoFoco]?.focus();
    setProximoFoco(null);
  }, [proximoFoco, fields.length]);

  const itensAtuais = form.watch("itens");
  // O campo "Preço" guarda o total da linha (não o unitário), então o total é a
  // soma direta dos preços − desconto, sem multiplicar de novo pela quantidade.
  // A conversão para preço unitário (o que o banco/PDF usam) acontece no submit.
  const totalAoVivo = (itensAtuais ?? []).reduce((soma, item) => {
    const preco = Number(item.precoUnitario) || 0;
    const desc = Number(item.desconto) || 0;
    return soma + arredondarCentavos(preco - desc);
  }, 0);

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
    const custo = Number(form.getValues(`itens.${index}.custoCotado`)) || 0;
    sincronizarPrecoComCusto(index, proximo, custo);
  }

  // Preenche o preço com o total da linha (qtd × custo unitário) sempre que há
  // custo cotado. O campo continua editável — a Michele pode digitar outro valor
  // por cima. Sem custo, não mexe: linhas de serviço seguem com preço manual.
  function sincronizarPrecoComCusto(index: number, qtd: number, custo: number) {
    if (qtd <= 0 || custo <= 0) return;
    const total = Math.round((qtd * custo + Number.EPSILON) * 100) / 100;
    form.setValue(`itens.${index}.precoUnitario`, String(total), {
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

  // A descrição digitada bateu com algo do catálogo? Então classifica o tipo
  // sozinho e, no caso de serviço, já traz o preço cadastrado — é o que evita
  // redigitar "Troca de óleo e filtro" e o preço dela toda semana. O campo
  // continua editável: o preço sugerido é ponto de partida, não trava.
  function escolherSugestao(index: number, valor: string) {
    const peca = pecas.find((p) => p.nome === valor);
    form.setValue(`itens.${index}.pecaId`, peca?.id ?? "");
    if (peca) {
      const tipoPeca = tiposUsaveis.find((t) => t.natureza === "peca") ?? tipoPadrao;
      escolherTipo(index, tipoPeca.id);
      return;
    }

    const servico = servicos.find((s) => s.nome === valor);
    if (!servico) return;

    const tipoServico = tiposUsaveis.find((t) => t.natureza === "servico") ?? tipoPadrao;
    escolherTipo(index, tipoServico.id);

    if (servico.preco_padrao > 0) {
      // O campo "Preço" guarda o total da linha, então multiplica pela qtd.
      const qtd = Number(form.getValues(`itens.${index}.quantidade`)) || 1;
      form.setValue(
        `itens.${index}.precoUnitario`,
        String(arredondarCentavos(servico.preco_padrao * qtd)),
        { shouldDirty: true, shouldValidate: true }
      );
    }
  }

  // Preenche o preço a partir do custo × markup da oficina, nas linhas que já
  // têm custo. O preço continua editável — é só um ponto de partida.
  function aplicarMarkupTodos() {
    let aplicados = 0;
    form.getValues("itens").forEach((item, index) => {
      const custo = Number(item.custoCotado);
      const qtd = Number(item.quantidade) || 0;
      if (item.custoCotado !== "" && custo > 0) {
        // markup dá o unitário; o campo mostra o total da linha (× quantidade).
        const precoLinha = arredondarCentavos(aplicarMarkup(custo, markup) * qtd);
        form.setValue(`itens.${index}.precoUnitario`, String(precoLinha), {
          shouldDirty: true,
        });
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
      // O form traz o preço como total da linha; o banco espera o unitário.
      const dadosParaSalvar: FormOutput = {
        ...dados,
        itens: dados.itens.map((item) => ({
          ...item,
          precoUnitario: totalDaLinhaParaUnitario(item.precoUnitario, item.quantidade),
        })),
      };
      const resultado = await salvarDiagnosticoAction(ordemId, dadosParaSalvar);
      if (!resultado.ok) {
        setErro(resultado.erro);
        return;
      }
      setOrcamentoId(resultado.data.orcamentoId);
      // Marca o estado atual como "salvo" (limpa o dirty) para liberar o PDF.
      form.reset(form.getValues());
      // Feito o orçamento de um carro que ainda está em "Aguardando", ele avança
      // sozinho para "Esperando Confirmação do Cliente" — a Michele acabou de
      // montar o que vai mandar pro cliente aprovar.
      if (statusOs === "aguardando") {
        const mov = await enviarConfirmacaoAction(ordemId);
        toast.success(
          mov.ok
            ? "Orçamento salvo. OS movida para Esperando Confirmação do Cliente."
            : "Orçamento salvo. Baixe o PDF para enviar ao cliente."
        );
      } else {
        toast.success("Orçamento salvo. Baixe o PDF para enviar ao cliente.");
      }
      router.refresh();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <FileText className="size-4" />
        Orçamento
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Orçamento da OS #{numero}</DialogTitle>
        </DialogHeader>

        {/* Sugestões da descrição: peças do estoque + serviços do catálogo
            (Configurações). Com o Estoque desligado, `pecas` vem vazio e o
            catálogo de serviços carrega o autocomplete sozinho. */}
        <datalist id={datalistId}>
          {pecas.map((p) => (
            <option key={`peca-${p.id}`} value={p.nome} />
          ))}
          {servicos.map((s) => (
            <option key={`servico-${s.id}`} value={s.nome} />
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
                          list={datalistId}
                          placeholder="Peça ou serviço"
                          onChange={(e) => {
                            descField.onChange(e);
                            escolherSugestao(index, e.target.value);
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
                        {...form.register(`itens.${index}.quantidade`, {
                          onChange: (e) =>
                            sincronizarPrecoComCusto(
                              index,
                              Number(e.target.value) || 0,
                              Number(form.getValues(`itens.${index}.custoCotado`)) || 0
                            ),
                        })}
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
                      {...form.register(`itens.${index}.custoCotado`, {
                        onChange: (e) =>
                          sincronizarPrecoComCusto(
                            index,
                            Number(form.getValues(`itens.${index}.quantidade`)) || 0,
                            Number(e.target.value) || 0
                          ),
                      })}
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
                nativeButton={false}
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
