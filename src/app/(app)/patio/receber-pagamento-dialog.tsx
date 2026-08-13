"use client";

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Wallet } from "lucide-react";
import type { z } from "zod";
import { receberPagamentoSchema } from "@/lib/validators/financeiro.schema";
import {
  buscarPagamentoOsAction,
  receberPagamentoOsAction,
} from "@/modules/patio/application/ordem-servico.actions";
import type { ParcelaReceber } from "@/modules/patio/data/ordem-servico.repository";
import { FORMAS_PAGAMENTO, FORMA_PAGAMENTO_LABEL } from "@/modules/financeiro/domain/types";
import { formatarDinheiro, hojeSaoPaulo } from "@/lib/format";
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

type FormValues = z.input<typeof receberPagamentoSchema>;
type FormOutput = z.output<typeof receberPagamentoSchema>;

function valoresIniciais(): FormValues {
  return { dataPagamento: hojeSaoPaulo(), formaPagamento: "dinheiro", observacoes: "" };
}

export function ReceberPagamentoDialog({
  ordemId,
  numero,
  open: openControlado,
  onOpenChange,
}: {
  ordemId: string;
  numero: number;
  // Opcionais: quando o card monta o dialog só no clique (MontarAoAbrir), quem
  // manda no aberto/fechado é ele. Sem essas props, o dialog cuida de si.
  open?: boolean;
  onOpenChange?: (aberto: boolean) => void;
}) {
  const [openInterno, setOpenInterno] = useState(false);
  const open = openControlado ?? openInterno;
  const setOpen = onOpenChange ?? setOpenInterno;
  const [carregando, setCarregando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [parcelas, setParcelas] = useState<ParcelaReceber[]>([]);

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(receberPagamentoSchema),
    defaultValues: valoresIniciais(),
  });

  useEffect(() => {
    if (!open) return;
    setErro(null);
    form.reset(valoresIniciais());
    setCarregando(true);
    buscarPagamentoOsAction(ordemId)
      .then((p) => setParcelas(p))
      .finally(() => setCarregando(false));
    // form é estável; recarrega sempre que o dialog abre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ordemId]);

  const totalDevido = parcelas.reduce((soma, p) => soma + p.saldo, 0);

  async function onSubmit(dados: FormOutput) {
    setErro(null);
    setEnviando(true);
    try {
      const resultado = await receberPagamentoOsAction(ordemId, dados);
      if (!resultado.ok) {
        setErro(resultado.erro);
        return;
      }
      toast.success(`Pagamento recebido — ${formatarDinheiro(totalDevido)} baixado(s) no Financeiro.`);
      setOpen(false);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <Wallet className="size-4" />
        Receber pagamento
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Receber pagamento — OS #{numero}</DialogTitle>
        </DialogHeader>

        {carregando ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Carregando...</p>
        ) : parcelas.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nada a receber nesta OS.
          </p>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <div className="grid gap-1.5 rounded-lg bg-muted/40 p-3">
              {parcelas.map((p) => (
                <div key={p.parcelaId} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-muted-foreground">{p.descricao}</span>
                  <span className="shrink-0 font-medium">{formatarDinheiro(p.saldo)}</span>
                </div>
              ))}
              <div className="mt-1 flex items-center justify-between gap-2 border-t border-foreground/10 pt-2">
                <span className="font-medium">Total</span>
                <span className="font-heading text-lg">{formatarDinheiro(totalDevido)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label required>Forma de pagamento</Label>
                <Controller
                  name="formaPagamento"
                  control={form.control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione">
                          {(v: string) => FORMA_PAGAMENTO_LABEL[v] ?? "Selecione"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {FORMAS_PAGAMENTO.map((f) => (
                          <SelectItem key={f} value={f}>
                            {FORMA_PAGAMENTO_LABEL[f]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="dataPagamento" required>
                  Data
                </Label>
                <Input id="dataPagamento" type="date" {...form.register("dataPagamento")} />
                <Erro msg={form.formState.errors.dataPagamento?.message} />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="observacoes">Observações (opcional)</Label>
              <Textarea id="observacoes" rows={2} {...form.register("observacoes")} />
            </div>

            <Erro msg={erro} />

            <DialogFooter>
              <Button
                type="submit"
                disabled={enviando}
                className="bg-action text-action-foreground hover:bg-action/90"
              >
                Confirmar recebimento
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
