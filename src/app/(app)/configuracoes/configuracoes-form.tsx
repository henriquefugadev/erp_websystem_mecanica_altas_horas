"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  workshopSchema,
  type WorkshopFormValues,
  type WorkshopInput,
} from "@/lib/validators/workshop.schema";
import {
  atualizarConfiguracaoAction,
  enviarLogoAction,
  removerLogoAction,
} from "@/modules/workshop/application/workshop.actions";
import { normalizarCEP } from "@/lib/validators/contato";
import { buscarEnderecoPorCep } from "@/lib/format/via-cep";
import type { Workshop } from "@/modules/workshop/domain/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function valoresIniciais(workshop: Workshop): WorkshopFormValues {
  return {
    nome: workshop.nome,
    razaoSocial: workshop.razao_social ?? "",
    cnpj: workshop.cnpj ?? "",
    telefone: workshop.telefone ?? "",
    email: workshop.email ?? "",
    cep: workshop.cep ?? "",
    logradouro: workshop.logradouro ?? "",
    numero: workshop.numero ?? "",
    complemento: workshop.complemento ?? "",
    bairro: workshop.bairro ?? "",
    cidade: workshop.cidade ?? "",
    estado: workshop.estado ?? "",
    condicoesPagamentoPadrao: workshop.condicoes_pagamento_padrao ?? "",
    validadeOrcamentoDias: workshop.validade_orcamento_dias,
  };
}

export function ConfiguracoesForm({
  workshop,
  logoUrl,
}: {
  workshop: Workshop;
  logoUrl: string | null;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [enviandoLogo, setEnviandoLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<WorkshopFormValues, unknown, WorkshopInput>({
    resolver: zodResolver(workshopSchema),
    defaultValues: valoresIniciais(workshop),
  });

  const errors = form.formState.errors;
  const cepRegister = form.register("cep");

  async function onSubmit(dados: WorkshopInput) {
    setErro(null);
    const resultado = await atualizarConfiguracaoAction(dados);
    if (!resultado.ok) {
      setErro(resultado.erro);
      return;
    }
    toast.success("Configurações salvas.");
    router.refresh();
  }

  async function preencherPorCep() {
    const digitos = normalizarCEP(form.getValues("cep") ?? "");
    if (digitos.length !== 8) return;

    setBuscandoCep(true);
    const endereco = await buscarEnderecoPorCep(digitos);
    setBuscandoCep(false);
    if (!endereco) return;

    if (!form.getValues("logradouro") && endereco.logradouro) {
      form.setValue("logradouro", endereco.logradouro, { shouldValidate: true });
    }
    if (!form.getValues("bairro") && endereco.bairro) form.setValue("bairro", endereco.bairro);
    if (!form.getValues("cidade") && endereco.cidade) form.setValue("cidade", endereco.cidade);
    if (!form.getValues("estado") && endereco.estado) form.setValue("estado", endereco.estado);
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;

    setEnviandoLogo(true);
    const formData = new FormData();
    formData.append("arquivo", arquivo);
    const resultado = await enviarLogoAction(formData);
    setEnviandoLogo(false);

    if (!resultado.ok) {
      toast.error(resultado.erro);
      return;
    }
    toast.success("Logo atualizado.");
    router.refresh();
  }

  async function handleRemoverLogo() {
    if (!workshop.logo_path) return;
    const resultado = await removerLogoAction(workshop.logo_path);
    if (!resultado.ok) {
      toast.error(resultado.erro);
      return;
    }
    toast.success("Logo removido.");
    router.refresh();
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Logo</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt="Logo da oficina"
              className="h-16 w-16 rounded-md border object-contain"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-md border border-dashed text-center text-xs text-muted-foreground">
              Sem logo
            </div>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={enviandoLogo}
              onClick={() => logoInputRef.current?.click()}
            >
              {enviandoLogo ? "Enviando..." : "Enviar logo"}
            </Button>
            {workshop.logo_path && (
              <Button type="button" variant="ghost" size="sm" onClick={handleRemoverLogo}>
                Remover
              </Button>
            )}
            <input
              ref={logoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/svg+xml"
              className="hidden"
              onChange={handleLogoChange}
            />
          </div>
        </CardContent>
      </Card>

      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados fiscais</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="nome" required>
                Nome fantasia
              </Label>
              <Input id="nome" {...form.register("nome")} />
              {errors.nome && <Erro msg={errors.nome.message} />}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="razaoSocial">Razão social</Label>
              <Input id="razaoSocial" {...form.register("razaoSocial")} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input id="cnpj" {...form.register("cnpj")} />
                {errors.cnpj && <Erro msg={errors.cnpj.message} />}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="telefone">Telefone</Label>
                <Input id="telefone" {...form.register("telefone")} />
                {errors.telefone && <Erro msg={errors.telefone.message} />}
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" {...form.register("email")} />
              {errors.email && <Erro msg={errors.email.message} />}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Endereço</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="cep">CEP</Label>
                <Input
                  id="cep"
                  {...cepRegister}
                  onBlur={(e) => {
                    cepRegister.onBlur(e);
                    preencherPorCep();
                  }}
                />
                {errors.cep && <Erro msg={errors.cep.message} />}
                {buscandoCep && (
                  <p className="text-xs text-muted-foreground">Buscando endereço…</p>
                )}
              </div>
              <div className="col-span-2 grid gap-1.5">
                <Label htmlFor="logradouro">Endereço</Label>
                <Input id="logradouro" {...form.register("logradouro")} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="numero">Número</Label>
                <Input id="numero" {...form.register("numero")} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="complemento">Complemento</Label>
                <Input id="complemento" {...form.register("complemento")} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="bairro">Bairro</Label>
                <Input id="bairro" {...form.register("bairro")} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 grid gap-1.5">
                <Label htmlFor="cidade">Cidade</Label>
                <Input id="cidade" {...form.register("cidade")} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="estado">UF</Label>
                <Input id="estado" maxLength={2} {...form.register("estado")} />
                {errors.estado && <Erro msg={errors.estado.message} />}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Padrões de orçamento</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="condicoesPagamentoPadrao">Condições de pagamento padrão</Label>
              <Textarea
                id="condicoesPagamentoPadrao"
                rows={2}
                placeholder="Ex.: 50% de entrada, restante na entrega"
                {...form.register("condicoesPagamentoPadrao")}
              />
            </div>
            <div className="grid max-w-40 gap-1.5">
              <Label htmlFor="validadeOrcamentoDias" required>
                Validade do orçamento (dias)
              </Label>
              <Input
                id="validadeOrcamentoDias"
                type="number"
                min={1}
                {...form.register("validadeOrcamentoDias")}
              />
              {errors.validadeOrcamentoDias && (
                <Erro msg={errors.validadeOrcamentoDias.message} />
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
            Salvar alterações
          </Button>
        </div>
      </form>
    </div>
  );
}

function Erro({ msg }: { msg?: string }) {
  return <p className="text-sm text-destructive">{msg}</p>;
}
