"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { pagamentoSchema } from "@/lib/validators/financeiro.schema";
import {
  pagamentoDefaultValues,
  type PagamentoFormOutput,
  type PagamentoFormValues,
} from "./pagamento-form-schema";
import { registrarPagamentoAction } from "@/modules/financeiro/application/pagamento.actions";
import { FORMAS_PAGAMENTO, FORMA_PAGAMENTO_LABEL } from "@/modules/financeiro/domain/types";
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
import { Erro } from "@/components/ui/erro";

export function RegistrarPagamentoDialog({
  parcelaId,
  contaId,
  saldo,
}: {
  parcelaId: string;
  contaId: string;
  saldo: number;
}) {
  const [open, setOpen] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const form = useForm<PagamentoFormValues, unknown, PagamentoFormOutput>({
    resolver: zodResolver(pagamentoSchema),
    defaultValues: pagamentoDefaultValues(saldo),
  });

  async function onSubmit(dados: PagamentoFormOutput) {
    setErro(null);
    setEnviando(true);
    try {
      const resultado = await registrarPagamentoAction(parcelaId, contaId, dados);
      if (!resultado.ok) {
        setErro(resultado.erro);
        return;
      }
      toast.success("Pagamento registrado.");
      setOpen(false);
      form.reset(pagamentoDefaultValues(saldo));
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
          form.reset(pagamentoDefaultValues(saldo));
        }
      }}
    >
      <DialogTrigger render={<Button size="sm" />}>Registrar pagamento</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar pagamento</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="valor" required>Valor pago (R$)</Label>
              <Input id="valor" type="text" inputMode="decimal" {...form.register("valor")} />
              <Erro msg={form.formState.errors.valor?.message} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="desconto">Desconto (R$)</Label>
              <Input
                id="desconto"
                type="text"
                inputMode="decimal"
                {...form.register("desconto")}
              />
              <Erro msg={form.formState.errors.desconto?.message} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="dataPagamento" required>Data do pagamento</Label>
              <Input id="dataPagamento" type="date" {...form.register("dataPagamento")} />
              <Erro msg={form.formState.errors.dataPagamento?.message} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="formaPagamento">Forma de pagamento</Label>
              <Controller
                name="formaPagamento"
                control={form.control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="formaPagamento">
                      <SelectValue>
                        {(v: string) => FORMA_PAGAMENTO_LABEL[v] ?? v}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {FORMAS_PAGAMENTO.map((forma) => (
                        <SelectItem key={forma} value={forma}>
                          {FORMA_PAGAMENTO_LABEL[forma]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea id="observacoes" rows={2} {...form.register("observacoes")} />
          </div>

          <p className="text-xs text-muted-foreground">
            Saldo em aberto desta parcela:{" "}
            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(saldo)}
          </p>

          <Erro msg={erro} />

          <DialogFooter>
            <Button
              type="submit"
              disabled={enviando}
              className="bg-action text-action-foreground hover:bg-action/90"
            >
              Confirmar pagamento
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

