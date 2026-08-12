"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Wrench } from "lucide-react";
import type { z } from "zod";
import { consumoPecaSchema } from "@/lib/validators/peca.schema";
import { consumirPecaOsAction } from "@/modules/estoque/application/consumo.actions";
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

export interface PecaOpcao {
  id: string;
  sku: string | null;
  nome: string;
  unidade: string;
  estoque_atual: number;
}

type FormValues = z.input<typeof consumoPecaSchema>;
type FormOutput = z.output<typeof consumoPecaSchema>;

function valoresIniciais(): FormValues {
  return { pecaId: "", quantidade: "" };
}

export function UsarPecaDialog({ ordemId, pecas }: { ordemId: string; pecas: PecaOpcao[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(consumoPecaSchema),
    defaultValues: valoresIniciais(),
  });

  async function onSubmit(dados: FormOutput) {
    setErro(null);
    setEnviando(true);
    try {
      const resultado = await consumirPecaOsAction(ordemId, dados);
      if (!resultado.ok) {
        setErro(resultado.erro);
        return;
      }
      toast.success("Baixa de estoque registrada.");
      setOpen(false);
      router.refresh();
    } finally {
      setEnviando(false);
    }
  }

  if (pecas.length === 0) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) {
          setErro(null);
          form.reset(valoresIniciais());
        }
      }}
    >
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <Wrench className="size-4" />
        Usar peça
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Usar peça</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label required>Peça</Label>
            <Controller
              name="pecaId"
              control={form.control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione">
                      {(v: string) => {
                        const peca = pecas.find((p) => p.id === v);
                        return peca ? `${peca.sku ? `${peca.sku} — ` : ""}${peca.nome}` : "Selecione";
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {pecas.map((peca) => (
                      <SelectItem key={peca.id} value={peca.id}>
                        {peca.sku ? `${peca.sku} — ` : ""}
                        {peca.nome} (estoque: {peca.estoque_atual} {peca.unidade})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.pecaId && <Erro msg={form.formState.errors.pecaId.message} />}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="quantidade" required>Quantidade</Label>
            <Input id="quantidade" type="text" inputMode="decimal" {...form.register("quantidade")} />
            {form.formState.errors.quantidade && (
              <Erro msg={form.formState.errors.quantidade.message} />
            )}
          </div>

          {erro && <p className="text-sm text-destructive">{erro}</p>}

          <DialogFooter>
            <Button
              type="submit"
              disabled={enviando}
              className="bg-action text-action-foreground hover:bg-action/90"
            >
              Confirmar baixa
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

