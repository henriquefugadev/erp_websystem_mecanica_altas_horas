"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
import { funcionarioSchema } from "@/lib/validators/funcionario.schema";
import {
  funcionarioDefaultValues,
  type FuncionarioFormOutput,
  type FuncionarioFormValues,
} from "./funcionario-form-schema";
import {
  atualizarFuncionarioAction,
  criarFuncionarioAction,
} from "@/modules/funcionarios/application/funcionario.actions";
import type { Funcionario } from "@/modules/funcionarios/domain/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

export function FuncionarioFormDialog({ funcionario }: { funcionario?: Funcionario }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const valores: FuncionarioFormValues = funcionario
    ? {
        nome: funcionario.nome,
        funcao: funcionario.funcao ?? "",
        telefone: funcionario.telefone ?? "",
        email: funcionario.email ?? "",
        observacoes: funcionario.observacoes ?? "",
        ativo: funcionario.ativo,
      }
    : funcionarioDefaultValues();

  const form = useForm<FuncionarioFormValues, unknown, FuncionarioFormOutput>({
    resolver: zodResolver(funcionarioSchema),
    defaultValues: valores,
  });

  async function onSubmit(dados: FuncionarioFormOutput) {
    setErro(null);
    setEnviando(true);
    try {
      const resultado = funcionario
        ? await atualizarFuncionarioAction(funcionario.id, dados)
        : await criarFuncionarioAction(dados);

      if (!resultado.ok) {
        setErro(resultado.erro);
        return;
      }
      toast.success(funcionario ? "Funcionário atualizado." : "Funcionário cadastrado.");
      setOpen(false);
      form.reset(funcionarioDefaultValues());
      router.refresh();
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
          funcionario ? (
            <Button variant="ghost" size="icon-sm">
              <Pencil className="size-4" />
              <span className="sr-only">Editar</span>
            </Button>
          ) : (
            <Button className="bg-action text-action-foreground hover:bg-action/90">
              <Plus className="size-4" />
              Novo funcionário
            </Button>
          )
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{funcionario ? "Editar funcionário" : "Novo funcionário"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="nome" required>Nome</Label>
            <Input id="nome" {...form.register("nome")} />
            {form.formState.errors.nome && (
              <p className="text-sm text-destructive">{form.formState.errors.nome.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="funcao">Função (opcional)</Label>
              <Input id="funcao" placeholder="Mecânico, Atendente..." {...form.register("funcao")} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ativo">Status</Label>
              <Controller
                name="ativo"
                control={form.control}
                render={({ field }) => (
                  <Select
                    value={field.value ? "true" : "false"}
                    onValueChange={(v) => field.onChange(v === "true")}
                  >
                    <SelectTrigger id="ativo">
                      <SelectValue>{(v: string) => (v === "true" ? "Ativo" : "Inativo")}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Ativo</SelectItem>
                      <SelectItem value="false">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="telefone">Telefone (opcional)</Label>
              <Input id="telefone" {...form.register("telefone")} />
              {form.formState.errors.telefone && (
                <p className="text-sm text-destructive">{form.formState.errors.telefone.message}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="email">E-mail (opcional)</Label>
              <Input id="email" {...form.register("email")} />
              {form.formState.errors.email && (
                <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="observacoes">Observações (opcional)</Label>
            <Textarea id="observacoes" rows={2} {...form.register("observacoes")} />
          </div>

          {erro && <p className="text-sm text-destructive">{erro}</p>}

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
