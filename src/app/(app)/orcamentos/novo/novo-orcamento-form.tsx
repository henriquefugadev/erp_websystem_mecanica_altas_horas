"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import {
  orcamentoSchema,
  type OrcamentoInput,
  type OrcamentoOutput,
} from "@/lib/validators/orcamento.schema";
import { criarOrcamentoAction } from "@/modules/orcamento/application/orcamento.actions";
import type { ClienteOpcaoBusca } from "@/modules/crm/application/cliente.actions";
import { calcularTotalOrcamento } from "@/modules/orcamento/domain/calculo";
import { formatarDinheiro, formatarPlaca } from "@/lib/format";
import { ClienteCombobox } from "@/components/crm/cliente-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Erro } from "@/components/ui/erro";

const DATALIST_PECAS = "orcamento-pecas-catalogo";

interface PecaOpcao {
  id: string;
  nome: string;
  precoVenda: number;
}

function itemVazio(): OrcamentoInput["itens"][number] {
  return {
    tipo: "servico",
    pecaId: "",
    descricao: "",
    quantidade: "",
    precoUnitario: "",
    desconto: "",
  };
}

function valoresIniciais(
  condicoesPagamentoPadrao: string,
  validadePadrao: string
): OrcamentoInput {
  return {
    clienteId: "",
    veiculoId: "",
    queixa: "",
    observacoes: "",
    condicoesPagamento: condicoesPagamentoPadrao,
    validade: validadePadrao,
    itens: [itemVazio()],
  };
}

export function NovoOrcamentoForm({
  condicoesPagamentoPadrao,
  validadePadrao,
  pecas,
}: {
  condicoesPagamentoPadrao: string;
  validadePadrao: string;
  pecas: PecaOpcao[];
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteOpcaoBusca | null>(null);

  // Ao escolher uma peça do catálogo pelo nome: grava o peca_id, marca como
  // peça e sugere o preço de venda cadastrado (se o campo ainda estiver vazio).
  function escolherPeca(index: number, valor: string) {
    const peca = pecas.find((p) => p.nome === valor);
    form.setValue(`itens.${index}.pecaId`, peca?.id ?? "");
    if (peca) {
      form.setValue(`itens.${index}.tipo`, "peca");
      if (!form.getValues(`itens.${index}.precoUnitario`)) {
        form.setValue(`itens.${index}.precoUnitario`, String(peca.precoVenda));
      }
    }
  }

  const form = useForm<OrcamentoInput, unknown, OrcamentoOutput>({
    resolver: zodResolver(orcamentoSchema),
    defaultValues: valoresIniciais(condicoesPagamentoPadrao, validadePadrao),
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "itens" });

  const clienteId = form.watch("clienteId");
  const itensAtuais = form.watch("itens");
  const veiculosDoCliente = clienteSelecionado?.veiculo ?? [];

  const totalAoVivo = calcularTotalOrcamento(
    itensAtuais.map((item) => ({
      quantidade: Number(item.quantidade) || 0,
      precoUnitario: Number(item.precoUnitario) || 0,
      desconto: Number(item.desconto) || 0,
    }))
  );

  async function onSubmit(dados: OrcamentoOutput) {
    setErro(null);
    const resultado = await criarOrcamentoAction(dados);
    if (!resultado.ok) {
      setErro(resultado.erro);
      return;
    }
    toast.success("Orçamento criado.");
    router.push(`/orcamentos/${resultado.data.id}`);
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6">
      <Card>
        <CardContent className="grid gap-4 pt-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="clienteId" required>
                Cliente
              </Label>
              <Controller
                name="clienteId"
                control={form.control}
                render={({ field }) => (
                  <ClienteCombobox
                    id="clienteId"
                    value={clienteSelecionado}
                    onSelect={(cliente) => {
                      setClienteSelecionado(cliente);
                      field.onChange(cliente?.id ?? "");
                      form.setValue("veiculoId", "");
                    }}
                  />
                )}
              />
              {form.formState.errors.clienteId && (
                <Erro msg={form.formState.errors.clienteId.message} />
              )}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="veiculoId" required>
                Veículo
              </Label>
              <Controller
                name="veiculoId"
                control={form.control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={!clienteId}>
                    <SelectTrigger id="veiculoId">
                      <SelectValue
                        placeholder={clienteId ? "Selecione" : "Escolha o cliente primeiro"}
                      >
                        {(v: string) => {
                          const veiculo = veiculosDoCliente.find((x) => x.id === v);
                          return veiculo
                            ? `${veiculo.modelo} — ${formatarPlaca(veiculo.placa)}`
                            : "Selecione";
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {veiculosDoCliente.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.modelo} — {formatarPlaca(v.placa)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.veiculoId && (
                <Erro msg={form.formState.errors.veiculoId.message} />
              )}
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="queixa" required>
              Queixa do cliente
            </Label>
            <Textarea id="queixa" rows={2} {...form.register("queixa")} />
            {form.formState.errors.queixa && <Erro msg={form.formState.errors.queixa.message} />}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="observacoes">Observações / diagnóstico (opcional)</Label>
            <Textarea id="observacoes" rows={2} {...form.register("observacoes")} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-3 pt-6">
          <Label>Itens</Label>

          <datalist id={DATALIST_PECAS}>
            {pecas.map((p) => (
              <option key={p.id} value={p.nome} />
            ))}
          </datalist>

          {fields.map((field, index) => (
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
                        <SelectItem value="servico">Serviço</SelectItem>
                        <SelectItem value="peca">Peça</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="col-span-4 grid gap-1.5">
                {index === 0 && <Label required>Descrição</Label>}
                {(() => {
                  const reg = form.register(`itens.${index}.descricao`);
                  return (
                    <Input
                      list={DATALIST_PECAS}
                      {...reg}
                      onChange={(e) => {
                        reg.onChange(e);
                        escolherPeca(index, e.target.value);
                      }}
                    />
                  );
                })()}
              </div>
              <div className="col-span-2 grid gap-1.5">
                {index === 0 && <Label required>Qtd.</Label>}
                <Input
                  type="text"
                  inputMode="decimal"
                  {...form.register(`itens.${index}.quantidade`)}
                />
              </div>
              <div className="col-span-2 grid gap-1.5">
                {index === 0 && <Label required>Preço unit.</Label>}
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
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() => append(itemVazio())}
          >
            <Plus className="size-4" />
            Adicionar item
          </Button>

          {typeof form.formState.errors.itens?.message === "string" && (
            <Erro msg={form.formState.errors.itens.message} />
          )}

          <p className="text-right text-lg font-medium">Total: {formatarDinheiro(totalAoVivo)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 pt-6">
          <div className="grid gap-1.5">
            <Label htmlFor="condicoesPagamento">Condições de pagamento</Label>
            <Textarea id="condicoesPagamento" rows={2} {...form.register("condicoesPagamento")} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="validade" required>
              Válido até
            </Label>
            <Input id="validade" type="date" {...form.register("validade")} />
            {form.formState.errors.validade && (
              <Erro msg={form.formState.errors.validade.message} />
            )}
          </div>
        </CardContent>
      </Card>

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      <div>
        <Button
          type="submit"
          disabled={form.formState.isSubmitting}
          className="bg-action text-action-foreground hover:bg-action/90"
        >
          Criar orçamento
        </Button>
      </div>
    </form>
  );
}

