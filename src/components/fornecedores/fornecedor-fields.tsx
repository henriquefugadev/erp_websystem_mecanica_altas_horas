"use client";

import type { FieldErrors, UseFormRegister } from "react-hook-form";
import type { FornecedorFormValues } from "./fornecedor-form-schema";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Erro } from "@/components/ui/erro";

export function FornecedorFields({
  register,
  errors,
}: {
  register: UseFormRegister<FornecedorFormValues>;
  errors: FieldErrors<FornecedorFormValues>;
}) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="nome" required>Nome / Razão social</Label>
        <Input id="nome" {...register("nome")} />
        <Erro msg={errors.nome?.message} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="documento">CPF/CNPJ (opcional)</Label>
          <Input id="documento" {...register("documento")} />
          <Erro msg={errors.documento?.message} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="contatoNome">Contato/vendedor (opcional)</Label>
          <Input id="contatoNome" {...register("contatoNome")} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="telefone">Telefone (opcional)</Label>
          <Input id="telefone" {...register("telefone")} />
          <Erro msg={errors.telefone?.message} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="email">E-mail (opcional)</Label>
          <Input id="email" type="email" {...register("email")} />
          <Erro msg={errors.email?.message} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="condicoesPagamento">Condições de pagamento (opcional)</Label>
          <Input id="condicoesPagamento" placeholder="Ex.: 30 dias" {...register("condicoesPagamento")} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="prazoEntregaDias">Prazo de entrega, em dias (opcional)</Label>
          <Input id="prazoEntregaDias" type="number" min={1} {...register("prazoEntregaDias")} />
          <Erro msg={errors.prazoEntregaDias?.message} />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="observacoes">Observações (opcional)</Label>
        <Textarea id="observacoes" rows={3} {...register("observacoes")} />
      </div>
    </div>
  );
}

