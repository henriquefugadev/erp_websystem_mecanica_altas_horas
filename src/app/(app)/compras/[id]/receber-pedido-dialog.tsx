"use client";

import { useState } from "react";
import { toast } from "sonner";
import { receberPedidoAction } from "@/modules/fornecedores/application/pedido-compra.actions";
import { hojeSaoPaulo, formatarDinheiro } from "@/lib/format";
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
import { Erro } from "@/components/ui/erro";

interface ItemPendente {
  id: string;
  descricao: string;
  saldo: number;
  preco_unitario: number;
}

export function ReceberPedidoDialog({
  pedidoId,
  itensPendentes,
}: {
  pedidoId: string;
  itensPendentes: ItemPendente[];
}) {
  const [open, setOpen] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [quantidades, setQuantidades] = useState<Record<string, string>>({});
  const [dataRecebimento, setDataRecebimento] = useState(hojeSaoPaulo());
  const [vencimento, setVencimento] = useState("");
  const [observacoes, setObservacoes] = useState("");

  if (itensPendentes.length === 0) return null;

  function abrir(v: boolean) {
    setOpen(v);
    if (v) {
      setErro(null);
      setDataRecebimento(hojeSaoPaulo());
      setVencimento("");
      setObservacoes("");
      // Sugere receber o saldo pendente inteiro — o caso mais comum é
      // entrega completa; Michele só ajusta se vier parcial.
      setQuantidades(
        Object.fromEntries(itensPendentes.map((item) => [item.id, String(item.saldo)]))
      );
    }
  }

  const total = itensPendentes.reduce((acc, item) => {
    const qtd = Number(quantidades[item.id]) || 0;
    return acc + qtd * item.preco_unitario;
  }, 0);

  async function confirmar() {
    setErro(null);
    const itens = itensPendentes
      .map((item) => ({ pedidoItemId: item.id, quantidade: Number(quantidades[item.id]) || 0 }))
      .filter((item) => item.quantidade > 0);

    if (itens.length === 0) {
      setErro("Informe a quantidade recebida de ao menos um item.");
      return;
    }
    if (!vencimento) {
      setErro("Informe o vencimento da conta a pagar.");
      return;
    }

    setEnviando(true);
    try {
      const resultado = await receberPedidoAction(pedidoId, {
        dataRecebimento,
        vencimento,
        observacoes,
        itens,
      });
      if (!resultado.ok) {
        setErro(resultado.erro);
        return;
      }
      toast.success("Recebimento registrado — conta a pagar gerada no Financeiro.");
      if (resultado.data.osLiberada !== null) {
        toast.success(
          `Peças chegaram — OS #${resultado.data.osLiberada} liberada para execução.`
        );
      }
      setOpen(false);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={abrir}>
      <DialogTrigger
        render={<Button className="bg-action text-action-foreground hover:bg-action/90" />}
      >
        Registrar recebimento
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar recebimento</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Itens pendentes</Label>
            {itensPendentes.map((item) => (
              <div key={item.id} className="flex items-end gap-2">
                <div className="flex-1 text-sm">
                  <p>{item.descricao}</p>
                  <p className="text-xs text-muted-foreground">Pendente: {item.saldo}</p>
                </div>
                <div className="grid w-24 gap-1.5">
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={quantidades[item.id] ?? ""}
                    onChange={(e) =>
                      setQuantidades((q) => ({ ...q, [item.id]: e.target.value }))
                    }
                  />
                </div>
              </div>
            ))}
            <p className="text-sm text-muted-foreground">Valor a lançar: {formatarDinheiro(total)}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="dataRecebimento" required>Data do recebimento</Label>
              <Input
                id="dataRecebimento"
                type="date"
                value={dataRecebimento}
                onChange={(e) => setDataRecebimento(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="vencimento" required>Vencimento (conta a pagar)</Label>
              <Input
                id="vencimento"
                type="date"
                value={vencimento}
                onChange={(e) => setVencimento(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="observacoes">Observações (opcional)</Label>
            <Textarea
              id="observacoes"
              rows={2}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
            />
          </div>

          <Erro msg={erro} />
        </div>

        <DialogFooter>
          <Button
            onClick={confirmar}
            disabled={enviando}
            className="bg-action text-action-foreground hover:bg-action/90"
          >
            Confirmar recebimento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
