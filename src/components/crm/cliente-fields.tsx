"use client";

import { useState } from "react";
import type {
  FieldErrors,
  UseFormGetValues,
  UseFormRegister,
  UseFormSetValue,
} from "react-hook-form";
import type { ClienteFormValues } from "./cliente-form-schema";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Controller, type Control } from "react-hook-form";
import { normalizarCEP } from "@/lib/validators/contato";
import { buscarEnderecoPorCep } from "@/lib/format/via-cep";
import { Erro } from "@/components/ui/erro";

export function ClienteFields({
  register,
  errors,
  control,
  setValue,
  getValues,
}: {
  register: UseFormRegister<ClienteFormValues>;
  errors: FieldErrors<ClienteFormValues>;
  control: Control<ClienteFormValues>;
  setValue: UseFormSetValue<ClienteFormValues>;
  getValues: UseFormGetValues<ClienteFormValues>;
}) {
  const [buscandoCep, setBuscandoCep] = useState(false);
  const cepRegister = register("cep");

  async function preencherPorCep() {
    const digitos = normalizarCEP(getValues("cep") ?? "");
    if (digitos.length !== 8) return;

    setBuscandoCep(true);
    const endereco = await buscarEnderecoPorCep(digitos);
    setBuscandoCep(false);
    if (!endereco) return;

    if (!getValues("logradouro") && endereco.logradouro) {
      setValue("logradouro", endereco.logradouro, { shouldValidate: true });
    }
    if (!getValues("bairro") && endereco.bairro) {
      setValue("bairro", endereco.bairro);
    }
    if (!getValues("cidade") && endereco.cidade) {
      setValue("cidade", endereco.cidade);
    }
    if (!getValues("estado") && endereco.estado) {
      setValue("estado", endereco.estado);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="tipo">Tipo</Label>
          <Controller
            name="tipo"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="tipo">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PF">Pessoa física</SelectItem>
                  <SelectItem value="PJ">Pessoa jurídica</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          <Erro msg={errors.tipo?.message} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="documento">CPF/CNPJ</Label>
          <Input id="documento" {...register("documento")} />
          <Erro msg={errors.documento?.message} />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="nome" required>Nome / Razão social</Label>
        <Input id="nome" {...register("nome")} />
        <Erro msg={errors.nome?.message} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="telefone" required>Telefone</Label>
          <Input id="telefone" {...register("telefone")} />
          <Erro msg={errors.telefone?.message} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" {...register("email")} />
          <Erro msg={errors.email?.message} />
        </div>
      </div>

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
          <Erro msg={errors.cep?.message} />
          {buscandoCep && (
            <p className="text-xs text-muted-foreground">Buscando endereço…</p>
          )}
        </div>
        <div className="col-span-2 grid gap-1.5">
          <Label htmlFor="logradouro">Endereço</Label>
          <Input id="logradouro" {...register("logradouro")} />
          <Erro msg={errors.logradouro?.message} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="numero">Número</Label>
          <Input id="numero" {...register("numero")} />
          <Erro msg={errors.numero?.message} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="complemento">Complemento</Label>
          <Input id="complemento" {...register("complemento")} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="bairro">Bairro</Label>
          <Input id="bairro" {...register("bairro")} />
          <Erro msg={errors.bairro?.message} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 grid gap-1.5">
          <Label htmlFor="cidade">Cidade</Label>
          <Input id="cidade" {...register("cidade")} />
          <Erro msg={errors.cidade?.message} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="estado">UF</Label>
          <Input id="estado" maxLength={2} {...register("estado")} />
          <Erro msg={errors.estado?.message} />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="notas">Notas internas</Label>
        <Textarea id="notas" rows={3} {...register("notas")} />
      </div>
    </div>
  );
}

