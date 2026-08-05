"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { ordemServicoSchema, type OrdemServicoInput } from "@/lib/validators/ordem-servico.schema";
import { criarOrdemAction } from "@/modules/patio/application/ordem-servico.actions";
import type { ClienteOpcaoBusca } from "@/modules/crm/application/cliente.actions";
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
import { ClienteCombobox } from "@/components/crm/cliente-combobox";

export interface FuncionarioOpcao {
  id: string;
  nome: string;
}

const DEFAULT_VALUES: OrdemServicoInput = {
  clienteId: "",
  veiculoId: "",
  queixa: "",
  descricao: "",
  funcionarioId: "",
};

export function NovaOsDialog({
  funcionarios,
}: {
  funcionarios: FuncionarioOpcao[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteOpcaoBusca | null>(null);

  const form = useForm<OrdemServicoInput>({
    resolver: zodResolver(ordemServicoSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const clienteId = form.watch("clienteId");
  const veiculosDoCliente = clienteSelecionado?.veiculo ?? [];

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
          setClienteSelecionado(null);
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
            <Label htmlFor="clienteId" required>Cliente</Label>
            <Controller
              name="clienteId"
              control={form.control}
              render={({ field }) => (
                <ClienteCombobox
                  id="clienteId"
                  value={clienteSelecionado}
                  onSelect={(cliente) => {
                    setClienteSelecionado(cliente);
                    field.onChange(cliente?.id ?? "");
                    form.setValue("veiculoId", "");
                  }}
                />
              )}
            />
            {form.formState.errors.clienteId && (
              <Erro msg={form.formState.errors.clienteId.message} />
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="veiculoId" required>Veículo</Label>
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
            <Label htmlFor="queixa">Queixa do cliente (opcional)</Label>
            <Textarea id="queixa" rows={2} {...form.register("queixa")} />
            {form.formState.errors.queixa && <Erro msg={form.formState.errors.queixa.message} />}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="funcionarioId">Técnico (opcional)</Label>
              <Controller
                name="funcionarioId"
                control={form.control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="funcionarioId">
                      <SelectValue placeholder="Selecione">
                        {(v: string) => funcionarios.find((f) => f.id === v)?.nome ?? "Selecione"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
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
