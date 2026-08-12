"use client";

import type { FieldErrors, UseFormRegister } from "react-hook-form";
import type { VeiculoFormValues } from "./veiculo-form-schema";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Erro } from "@/components/ui/erro";

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
          <Label htmlFor="placa" required>Placa</Label>
          <Input id="placa" {...register("placa")} />
          {errors.placa && <Erro msg={errors.placa.message} />}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="modelo" required>Modelo</Label>
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
          <Label htmlFor="ano">Ano</Label>
          <Input id="ano" inputMode="numeric" {...register("ano")} />
          {errors.ano && <Erro msg={errors.ano.message} />}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="cor">Cor</Label>
          <Input id="cor" {...register("cor")} />
        </div>
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

      <div className="grid gap-1.5">
        <Label htmlFor="veiculo-notas">Notas</Label>
        <Textarea id="veiculo-notas" rows={2} {...register("notas")} />
      </div>
    </div>
  );
}

