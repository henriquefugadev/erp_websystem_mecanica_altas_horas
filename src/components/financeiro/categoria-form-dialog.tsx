"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
import { categoriaSchema } from "@/lib/validators/financeiro.schema";
import {
  categoriaDefaultValues,
  type CategoriaFormOutput,
  type CategoriaFormValues,
} from "./categoria-form-schema";
import {
  atualizarCategoriaAction,
  criarCategoriaAction,
} from "@/modules/financeiro/application/categoria.actions";
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
import { Erro } from "@/components/ui/erro";

export function CategoriaFormDialog({
  categoria,
  tipoInicial = "receita",
}: {
  categoria?: { id: string; tipo: "receita" | "despesa"; nome: string };
  tipoInicial?: "receita" | "despesa";
}) {
  const [open, setOpen] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const valores = categoria
    ? { tipo: categoria.tipo, nome: categoria.nome }
    : categoriaDefaultValues(tipoInicial);

  const form = useForm<CategoriaFormValues, unknown, CategoriaFormOutput>({
    resolver: zodResolver(categoriaSchema),
    defaultValues: valores,
  });

  async function onSubmit(dados: CategoriaFormOutput) {
    setErro(null);
    setEnviando(true);
    try {
      const resultado = categoria
        ? await atualizarCategoriaAction(categoria.id, dados)
        : await criarCategoriaAction(dados);

      if (!resultado.ok) {
        setErro(resultado.erro);
        return;
      }
      toast.success(categoria ? "Categoria atualizada." : "Categoria cadastrada.");
      setOpen(false);
      form.reset(categoriaDefaultValues(tipoInicial));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) {
          setErro(null);
          form.reset(valores);
        }
      }}
    >
      <DialogTrigger
        render={
          categoria ? (
            <Button variant="ghost" size="icon-sm">
              <Pencil className="size-4" />
              <span className="sr-only">Editar</span>
            </Button>
          ) : (
            <Button variant="outline" size="sm">
              <Plus className="size-4" />
              Nova categoria
            </Button>
          )
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{categoria ? "Editar categoria" : "Nova categoria"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="tipo">Tipo</Label>
            <Controller
              name="tipo"
              control={form.control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="tipo">
                    <SelectValue>
                      {(v: string) => (v === "receita" ? "Receita" : "Despesa")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="receita">Receita</SelectItem>
                    <SelectItem value="despesa">Despesa</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="nome" required>Nome</Label>
            <Input id="nome" {...form.register("nome")} />
            <Erro msg={form.formState.errors.nome?.message} />
          </div>

          <Erro msg={erro} />

          <DialogFooter>
            <Button
              type="submit"
              disabled={enviando}
              className="bg-action text-action-foreground hover:bg-action/90"
            >
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
