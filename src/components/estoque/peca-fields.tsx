"use client";

import type { FieldErrors, UseFormRegister } from "react-hook-form";
import type { PecaFormValues } from "./peca-form-schema";
import { UNIDADES_SUGERIDAS } from "@/modules/estoque/domain/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Erro } from "@/components/ui/erro";

export function PecaFields({
  register,
  errors,
}: {
  register: UseFormRegister<PecaFormValues>;
  errors: FieldErrors<PecaFormValues>;
}) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="nome" required>Nome</Label>
        <Input id="nome" {...register("nome")} />
        <Erro msg={errors.nome?.message} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="sku">SKU / código interno (opcional)</Label>
          <Input id="sku" {...register("sku")} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="unidade" required>Unidade</Label>
          <Input id="unidade" list="unidades-sugeridas" {...register("unidade")} />
          <datalist id="unidades-sugeridas">
            {UNIDADES_SUGERIDAS.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
          <Erro msg={errors.unidade?.message} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="fabricante">Fabricante (opcional)</Label>
          <Input id="fabricante" {...register("fabricante")} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="aplicacao">Aplicação (opcional)</Label>
          <Input id="aplicacao" placeholder="Ex.: Gol/Voyage 1.6 08-16" {...register("aplicacao")} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="precoVenda">Preço de venda (R$)</Label>
          <Input id="precoVenda" type="text" inputMode="decimal" {...register("precoVenda")} />
          <Erro msg={errors.precoVenda?.message} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="estoqueMinimo">Estoque mínimo (opcional)</Label>
          <Input id="estoqueMinimo" type="text" inputMode="decimal" {...register("estoqueMinimo")} />
          <Erro msg={errors.estoqueMinimo?.message} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="localizacao">Localização (opcional)</Label>
          <Input id="localizacao" placeholder="Ex.: Prateleira A3" {...register("localizacao")} />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="observacoes">Observações (opcional)</Label>
        <Textarea id="observacoes" rows={3} {...register("observacoes")} />
      </div>
    </div>
  );
}

