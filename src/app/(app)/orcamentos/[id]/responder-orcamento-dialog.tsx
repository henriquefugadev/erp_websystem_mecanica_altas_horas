"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check } from "lucide-react";
import type { OrcamentoComRelacoes } from "@/modules/orcamento/domain/types";
import {
  aprovarOrcamentoAction,
  recusarOrcamentoAction,
} from "@/modules/orcamento/application/orcamento.actions";
import { calcularSubtotalItem, calcularTotalOrcamento } from "@/modules/orcamento/domain/calculo";
import { formatarDinheiro } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function ResponderOrcamentoDialog({ orcamento }: { orcamento: OrcamentoComRelacoes }) {
  const router = useRouter();
  const itens = orcamento.orcamento_item;
  const [open, setOpen] = useState(false);
  const [processando, setProcessando] = useState(false);
  // Começa com tudo marcado (caso mais rápido: cliente aprovou tudo).
  const [marcados, setMarcados] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(itens.map((i) => [i.id, true]))
  );

  // Veio do pátio (diagnóstico) → não redireciona, só atualiza a OS existente.
  const veioDeOs = orcamento.ordem_servico_id !== null;
  const numeroOs = orcamento.ordem_servico?.numero;

  const idsMarcados = itens.filter((i) => marcados[i.id]).map((i) => i.id);
  const totalMarcado = calcularTotalOrcamento(
    itens
      .filter((i) => marcados[i.id])
      .map((i) => ({
        quantidade: i.quantidade,
        precoUnitario: i.preco_unitario,
        desconto: i.desconto,
      }))
  );

  function alternar(id: string) {
    setMarcados((atual) => ({ ...atual, [id]: !atual[id] }));
  }

  function marcarTodos() {
    setMarcados(Object.fromEntries(itens.map((i) => [i.id, true])));
  }

  async function registrar() {
    if (idsMarcados.length === 0) {
      toast.error("Marque ao menos um item, ou use “Recusar tudo”.");
      return;
    }
    setProcessando(true);
    const resultado = await aprovarOrcamentoAction(orcamento.id, idsMarcados);
    setProcessando(false);
    if (!resultado.ok) {
      toast.error(resultado.erro);
      return;
    }

    setOpen(false);
    if (veioDeOs) {
      toast.success(`Resposta registrada — OS #${numeroOs ?? ""} atualizada.`);
      if (resultado.data.faltaPeca) {
        toast.info("Há peças aprovadas a comprar — gere os pedidos de compra.");
      }
    } else {
      toast.success("Orçamento aprovado — OS aberta no Pátio.");
      router.push("/patio");
    }
  }

  async function recusarTudo() {
    setProcessando(true);
    const resultado = await recusarOrcamentoAction(orcamento.id);
    setProcessando(false);
    if (!resultado.ok) {
      toast.error(resultado.erro);
      return;
    }
    toast.success("Orçamento recusado.");
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) marcarTodos();
      }}
    >
      <DialogTrigger
        render={<Button size="sm" className="bg-action text-action-foreground hover:bg-action/90" />}
      >
        <Check className="size-4" />
        Registrar resposta do cliente
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resposta do cliente — Orçamento #{orcamento.numero}</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          Marque o que o cliente aprovou (os números batem com o PDF e o WhatsApp).
        </p>

        <div className="grid max-h-72 gap-1 overflow-y-auto">
          {itens.map((item, indice) => {
            const subtotal = calcularSubtotalItem({
              quantidade: item.quantidade,
              precoUnitario: item.preco_unitario,
              desconto: item.desconto,
            });
            return (
              <label
                key={item.id}
                className="flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-muted/60"
              >
                <input
                  type="checkbox"
                  checked={marcados[item.id] ?? false}
                  onChange={() => alternar(item.id)}
                  className="size-4 accent-[var(--action)]"
                />
                <span className="w-5 text-right text-sm text-muted-foreground">{indice + 1}.</span>
                <span className="flex-1 text-sm">
                  {item.descricao}{" "}
                  <span className="text-muted-foreground">(x{item.quantidade})</span>
                </span>
                <span className="text-sm">{formatarDinheiro(subtotal)}</span>
              </label>
            );
          })}
        </div>

        <div className="flex items-center justify-between border-t pt-3 text-sm">
          <button
            type="button"
            onClick={marcarTodos}
            className="text-muted-foreground underline hover:text-foreground"
          >
            Marcar todos
          </button>
          <span className="font-medium">
            Aprovado: {formatarDinheiro(totalMarcado)} ({idsMarcados.length}/{itens.length})
          </span>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button size="sm" variant="outline" disabled={processando} onClick={recusarTudo}>
            Recusar tudo
          </Button>
          <Button
            size="sm"
            disabled={processando}
            onClick={registrar}
            className="bg-action text-action-foreground hover:bg-action/90"
          >
            Registrar aprovação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
