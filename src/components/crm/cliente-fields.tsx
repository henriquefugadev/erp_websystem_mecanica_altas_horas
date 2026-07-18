"use client";

import type { FieldErrors, UseFormRegister } from "react-hook-form";
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

export function ClienteFields({
  register,
  errors,
  control,
}: {
  register: UseFormRegister<ClienteFormValues>;
  errors: FieldErrors<ClienteFormValues>;
  control: Control<ClienteFormValues>;
}) {
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
          {errors.tipo && <Erro msg={errors.tipo.message} />}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="documento">CPF/CNPJ</Label>
          <Input id="documento" {...register("documento")} />
          {errors.documento && <Erro msg={errors.documento.message} />}
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="nome">Nome / Razão social</Label>
        <Input id="nome" {...register("nome")} />
        {errors.nome && <Erro msg={errors.nome.message} />}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="telefone">Telefone</Label>
          <Input id="telefone" {...register("telefone")} />
          {errors.telefone && <Erro msg={errors.telefone.message} />}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" {...register("email")} />
          {errors.email && <Erro msg={errors.email.message} />}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="cep">CEP</Label>
          <Input id="cep" {...register("cep")} />
          {errors.cep && <Erro msg={errors.cep.message} />}
        </div>
        <div className="col-span-2 grid gap-1.5">
          <Label htmlFor="logradouro">Logradouro</Label>
          <Input id="logradouro" {...register("logradouro")} />
          {errors.logradouro && <Erro msg={errors.logradouro.message} />}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="numero">Número</Label>
          <Input id="numero" {...register("numero")} />
          {errors.numero && <Erro msg={errors.numero.message} />}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="complemento">Complemento</Label>
          <Input id="complemento" {...register("complemento")} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="bairro">Bairro</Label>
          <Input id="bairro" {...register("bairro")} />
          {errors.bairro && <Erro msg={errors.bairro.message} />}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 grid gap-1.5">
          <Label htmlFor="cidade">Cidade</Label>
          <Input id="cidade" {...register("cidade")} />
          {errors.cidade && <Erro msg={errors.cidade.message} />}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="estado">UF</Label>
          <Input id="estado" maxLength={2} {...register("estado")} />
          {errors.estado && <Erro msg={errors.estado.message} />}
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="notas">Notas internas</Label>
        <Textarea id="notas" rows={3} {...register("notas")} />
      </div>
    </div>
  );
}

function Erro({ msg }: { msg?: string }) {
  return <p className="text-sm text-destructive">{msg}</p>;
}
