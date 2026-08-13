"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ajusteSchema } from "@/lib/validators/peca.schema";
import { ajustarEstoqueAction } from "@/modules/estoque/application/peca.actions";
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

export function AjustarEstoqueDialog({
  pecaId,
  estoqueAtual,
  unidade,
}: {
  pecaId: string;
  estoqueAtual: number;
  unidade: string;
}) {
  const [open, setOpen] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [quantidadeContada, setQuantidadeContada] = useState("");
  const [observacao, setObservacao] = useState("");

  function abrir(v: boolean) {
    setOpen(v);
    if (v) {
      setErro(null);
      setQuantidadeContada(String(estoqueAtual));
      setObservacao("");
    }
  }

  async function confirmar() {
    setErro(null);
    const parsed = ajusteSchema.safeParse({ pecaId, quantidadeContada, observacao });
    if (!parsed.success) {
      setErro(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }

    setEnviando(true);
    try {
      const resultado = await ajustarEstoqueAction(parsed.data);
      if (!resultado.ok) {
        setErro(resultado.erro);
        return;
      }
      toast.success("Estoque ajustado.");
      setOpen(false);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={abrir}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        Ajustar (inventário)
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajustar estoque</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <p className="text-xs text-muted-foreground">
            Estoque atual do sistema: {estoqueAtual} {unidade}. Informe abaixo a quantidade
            realmente contada — a diferença vira um movimento de ajuste no histórico.
          </p>

          <div className="grid gap-1.5">
            <Label htmlFor="quantidadeContada" required>Quantidade contada ({unidade})</Label>
            <Input
              id="quantidadeContada"
              type="text"
              inputMode="decimal"
              value={quantidadeContada}
              onChange={(e) => setQuantidadeContada(e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="observacao">Motivo (opcional)</Label>
            <Textarea
              id="observacao"
              rows={2}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
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
            Confirmar ajuste
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
