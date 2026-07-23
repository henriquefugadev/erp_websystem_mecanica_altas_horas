"use client";

import {
  Controller,
  type Control,
  type FieldErrors,
  type UseFormRegister,
  type UseFormWatch,
} from "react-hook-form";
import type { ContaFormValues } from "./conta-form-schema";
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

interface Opcao {
  id: string;
  nome: string;
}

export function ContaFields({
  register,
  control,
  errors,
  watch,
  categoriasReceita,
  categoriasDespesa,
  clientes,
}: {
  register: UseFormRegister<ContaFormValues>;
  control: Control<ContaFormValues>;
  errors: FieldErrors<ContaFormValues>;
  watch: UseFormWatch<ContaFormValues>;
  categoriasReceita: Opcao[];
  categoriasDespesa: Opcao[];
  clientes: Opcao[];
}) {
  const tipo = watch("tipo");
  const categorias = tipo === "receber" ? categoriasReceita : categoriasDespesa;

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
                  <SelectValue>
                    {(v: string) => (v === "receber" ? "Conta a receber" : "Conta a pagar")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="receber">Conta a receber</SelectItem>
                  <SelectItem value="pagar">Conta a pagar</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="categoriaId" required>Categoria</Label>
          <Controller
            name="categoriaId"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="categoriaId">
                  <SelectValue placeholder="Selecione">
                    {(v: string) => categorias.find((c) => c.id === v)?.nome ?? "Selecione"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {categorias.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.categoriaId && <Erro msg={errors.categoriaId.message} />}
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="descricao" required>Descrição</Label>
        <Input id="descricao" {...register("descricao")} />
        {errors.descricao && <Erro msg={errors.descricao.message} />}
      </div>

      {tipo === "receber" ? (
        <div className="grid gap-1.5">
          <Label htmlFor="clienteId">Cliente (opcional)</Label>
          <Controller
            name="clienteId"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value || "nenhum"}
                onValueChange={(v) => field.onChange(v === "nenhum" ? "" : v)}
              >
                <SelectTrigger id="clienteId">
                  <SelectValue placeholder="Nenhum">
                    {(v: string) => clientes.find((c) => c.id === v)?.nome ?? "Nenhum"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Nenhum</SelectItem>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      ) : (
        <div className="grid gap-1.5">
          <Label htmlFor="fornecedorNome" required>Fornecedor</Label>
          <Input id="fornecedorNome" {...register("fornecedorNome")} />
          {errors.fornecedorNome && <Erro msg={errors.fornecedorNome.message} />}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="valorTotal" required>Valor total (R$)</Label>
          <Input
            id="valorTotal"
            type="text"
            inputMode="decimal"
            {...register("valorTotal")}
          />
          {errors.valorTotal && <Erro msg={errors.valorTotal.message} />}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="dataEmissao" required>Data de emissão</Label>
          <Input id="dataEmissao" type="date" {...register("dataEmissao")} />
          {errors.dataEmissao && <Erro msg={errors.dataEmissao.message} />}
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="observacoes">Observações</Label>
        <Textarea id="observacoes" rows={2} {...register("observacoes")} />
      </div>
    </div>
  );
}

function Erro({ msg }: { msg?: string }) {
  return <p className="text-sm text-destructive">{msg}</p>;
}
