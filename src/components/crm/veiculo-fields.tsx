"use client";

import type { FieldErrors, UseFormRegister } from "react-hook-form";
import type { VeiculoFormValues } from "./veiculo-form-schema";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function VeiculoFields({
  register,
  errors,
}: {
  register: UseFormRegister<VeiculoFormValues>;
  errors: FieldErrors<VeiculoFormValues>;
}) {
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="placa">Placa</Label>
          <Input id="placa" {...register("placa")} />
          {errors.placa && <Erro msg={errors.placa.message} />}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="modelo">Modelo</Label>
          <Input id="modelo" {...register("modelo")} />
          {errors.modelo && <Erro msg={errors.modelo.message} />}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="marca">Marca</Label>
          <Input id="marca" {...register("marca")} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="versao">Versão</Label>
          <Input id="versao" {...register("versao")} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ano">Ano</Label>
          <Input id="ano" inputMode="numeric" {...register("ano")} />
          {errors.ano && <Erro msg={errors.ano.message} />}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="combustivel">Combustível</Label>
          <Input id="combustivel" {...register("combustivel")} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="cor">Cor</Label>
          <Input id="cor" {...register("cor")} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="quilometragem">Quilometragem</Label>
          <Input
            id="quilometragem"
            inputMode="numeric"
            {...register("quilometragem")}
          />
          {errors.quilometragem && <Erro msg={errors.quilometragem.message} />}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="chassi">Chassi</Label>
          <Input id="chassi" {...register("chassi")} />
          {errors.chassi && <Erro msg={errors.chassi.message} />}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="renavam">Renavam</Label>
          <Input id="renavam" {...register("renavam")} />
          {errors.renavam && <Erro msg={errors.renavam.message} />}
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="veiculo-notas">Notas</Label>
        <Textarea id="veiculo-notas" rows={2} {...register("notas")} />
      </div>
    </div>
  );
}

function Erro({ msg }: { msg?: string }) {
  return <p className="text-sm text-destructive">{msg}</p>;
}
