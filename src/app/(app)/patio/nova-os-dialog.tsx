"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { ordemServicoSchema, type OrdemServicoInput } from "@/lib/validators/ordem-servico.schema";
import { criarOrdemAction } from "@/modules/patio/application/ordem-servico.actions";
import { formatarPlaca } from "@/lib/format";
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

export interface VeiculoOpcao {
  id: string;
  placa: string;
  modelo: string;
  marca: string | null;
}

export interface ClienteComVeiculos {
  id: string;
  nome: string;
  veiculo: VeiculoOpcao[];
}

const DEFAULT_VALUES: OrdemServicoInput = {
  clienteId: "",
  veiculoId: "",
  queixa: "",
  descricao: "",
  tecnico: "",
};

export function NovaOsDialog({ clientes }: { clientes: ClienteComVeiculos[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const form = useForm<OrdemServicoInput>({
    resolver: zodResolver(ordemServicoSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const clienteId = form.watch("clienteId");
  const veiculosDoCliente = clientes.find((c) => c.id === clienteId)?.veiculo ?? [];

  async function onSubmit(dados: OrdemServicoInput) {
    setErro(null);
    setEnviando(true);
    try {
      const resultado = await criarOrdemAction(dados);
      if (!resultado.ok) {
        setErro(resultado.erro);
        return;
      }
      toast.success("OS aberta — já está em Aguardando.");
      setOpen(false);
      form.reset(DEFAULT_VALUES);
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
          form.reset(DEFAULT_VALUES);
        }
      }}
    >
      <DialogTrigger
        render={<Button className="bg-action text-action-foreground hover:bg-action/90" />}
      >
        <Plus className="size-4" />
        Nova OS
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova ordem de serviço</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="clienteId">Cliente</Label>
            <Controller
              name="clienteId"
              control={form.control}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(v) => {
                    field.onChange(v);
                    form.setValue("veiculoId", "");
                  }}
                >
                  <SelectTrigger id="clienteId">
                    <SelectValue placeholder="Selecione">
                      {(v: string) => clientes.find((c) => c.id === v)?.nome ?? "Selecione"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {clientes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.clienteId && (
              <Erro msg={form.formState.errors.clienteId.message} />
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="veiculoId">Veículo</Label>
            <Controller
              name="veiculoId"
              control={form.control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={!clienteId}>
                  <SelectTrigger id="veiculoId">
                    <SelectValue
                      placeholder={clienteId ? "Selecione" : "Escolha o cliente primeiro"}
                    >
                      {(v: string) => {
                        const veiculo = veiculosDoCliente.find((x) => x.id === v);
                        return veiculo
                          ? `${veiculo.modelo} — ${formatarPlaca(veiculo.placa)}`
                          : "Selecione";
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {veiculosDoCliente.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.modelo} — {formatarPlaca(v.placa)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.veiculoId && (
              <Erro msg={form.formState.errors.veiculoId.message} />
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="queixa">Queixa do cliente</Label>
            <Textarea id="queixa" rows={2} {...form.register("queixa")} />
            {form.formState.errors.queixa && <Erro msg={form.formState.errors.queixa.message} />}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="tecnico">Técnico (opcional)</Label>
              <Input id="tecnico" {...form.register("tecnico")} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="descricao">Observações (opcional)</Label>
              <Input id="descricao" {...form.register("descricao")} />
            </div>
          </div>

          {erro && <p className="text-sm text-destructive">{erro}</p>}

          <DialogFooter>
            <Button
              type="submit"
              disabled={enviando}
              className="bg-action text-action-foreground hover:bg-action/90"
            >
              Abrir OS
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Erro({ msg }: { msg?: string }) {
  return <p className="text-sm text-destructive">{msg}</p>;
}
