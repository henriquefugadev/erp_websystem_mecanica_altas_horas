"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { editarOrdemSchema, type EditarOrdemInput } from "@/lib/validators/ordem-servico.schema";
import { editarOrdemAction } from "@/modules/patio/application/ordem-servico.actions";
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
import type { FuncionarioOpcao } from "./nova-os-dialog";
import { Erro } from "@/components/ui/erro";

// Sem técnico é um valor válido (a OS pode não ter ninguém atribuído). O Select
// não aceita "" como value de item, então uso este sentinela e converto na volta.
const SEM_TECNICO = "__sem_tecnico";

export function EditarOsDialog({
  ordemId,
  numero,
  funcionarios,
  tituloInicial,
  queixaInicial,
  descricaoInicial,
  funcionarioIdInicial,
  open: openControlado,
  onOpenChange,
}: {
  // Ver ReceberPagamentoDialog: opcionais, para o card poder montar sob demanda.
  open?: boolean;
  onOpenChange?: (aberto: boolean) => void;
  ordemId: string;
  numero: number;
  funcionarios: FuncionarioOpcao[];
  tituloInicial: string | null;
  queixaInicial: string | null;
  descricaoInicial: string | null;
  funcionarioIdInicial: string | null;
}) {
  const [openInterno, setOpenInterno] = useState(false);
  const open = openControlado ?? openInterno;
  const setOpen = onOpenChange ?? setOpenInterno;
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const form = useForm<EditarOrdemInput>({
    resolver: zodResolver(editarOrdemSchema),
    defaultValues: {
      titulo: tituloInicial ?? "",
      queixa: queixaInicial ?? "",
      descricao: descricaoInicial ?? "",
      funcionarioId: funcionarioIdInicial ?? "",
    },
  });

  function resetarComValoresAtuais() {
    form.reset({
      titulo: tituloInicial ?? "",
      queixa: queixaInicial ?? "",
      descricao: descricaoInicial ?? "",
      funcionarioId: funcionarioIdInicial ?? "",
    });
  }

  async function onSubmit(dados: EditarOrdemInput) {
    setErro(null);
    setEnviando(true);
    try {
      const resultado = await editarOrdemAction(ordemId, dados);
      if (!resultado.ok) {
        setErro(resultado.erro);
        return;
      }
      toast.success("OS atualizada.");
      setOpen(false);
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
          resetarComValoresAtuais();
        }
      }}
    >
      <DialogTrigger
        render={
          <Button size="icon-sm" variant="ghost" aria-label={`Editar OS #${numero}`} />
        }
      >
        <Pencil className="size-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar OS #{numero}</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="editar-titulo">Nome da OS</Label>
            <Input
              id="editar-titulo"
              placeholder="Ex.: Revisão 20 mil, Retorno garantia"
              {...form.register("titulo")}
            />
            <Erro msg={form.formState.errors.titulo?.message} />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="editar-queixa">Queixa do cliente</Label>
            <Textarea id="editar-queixa" rows={2} {...form.register("queixa")} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="editar-funcionario">Técnico</Label>
              <Controller
                name="funcionarioId"
                control={form.control}
                render={({ field }) => (
                  <Select
                    value={field.value ? field.value : SEM_TECNICO}
                    onValueChange={(v) => field.onChange(v === SEM_TECNICO ? "" : v)}
                  >
                    <SelectTrigger id="editar-funcionario">
                      <SelectValue placeholder="Sem técnico">
                        {(v: string) =>
                          v === SEM_TECNICO
                            ? "Sem técnico"
                            : funcionarios.find((f) => f.id === v)?.nome ?? "Sem técnico"
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SEM_TECNICO}>Sem técnico</SelectItem>
                      {funcionarios.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="editar-descricao">Observações</Label>
              <Input id="editar-descricao" {...form.register("descricao")} />
            </div>
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
