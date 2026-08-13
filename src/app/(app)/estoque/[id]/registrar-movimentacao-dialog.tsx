"use client";

import { useState } from "react";
import { toast } from "sonner";
import { movimentacaoSchema } from "@/lib/validators/peca.schema";
import { registrarMovimentacaoAction } from "@/modules/estoque/application/peca.actions";
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

type TipoManual = "entrada" | "devolucao" | "perda";

const TITULOS: Record<TipoManual, string> = {
  entrada: "Registrar entrada",
  devolucao: "Registrar devolução",
  perda: "Registrar perda/avaria",
};

export function RegistrarMovimentacaoDialog({
  pecaId,
  tipo,
  unidade,
}: {
  pecaId: string;
  tipo: TipoManual;
  unidade: string;
}) {
  const [open, setOpen] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [quantidade, setQuantidade] = useState("");
  const [custoUnitario, setCustoUnitario] = useState("");
  const [observacao, setObservacao] = useState("");

  function abrir(v: boolean) {
    setOpen(v);
    if (v) {
      setErro(null);
      setQuantidade("");
      setCustoUnitario("");
      setObservacao("");
    }
  }

  async function confirmar() {
    setErro(null);

    const parsed = movimentacaoSchema.safeParse({
      pecaId,
      tipo,
      quantidade,
      custoUnitario: tipo === "entrada" ? custoUnitario : "",
      observacao,
    });
    if (!parsed.success) {
      setErro(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }

    setEnviando(true);
    try {
      const resultado = await registrarMovimentacaoAction(parsed.data);
      if (!resultado.ok) {
        setErro(resultado.erro);
        return;
      }
      toast.success("Movimentação registrada.");
      setOpen(false);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={abrir}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>{TITULOS[tipo]}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{TITULOS[tipo]}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="quantidade" required>Quantidade ({unidade})</Label>
              <Input
                id="quantidade"
                type="text"
                inputMode="decimal"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
              />
            </div>
            {tipo === "entrada" && (
              <div className="grid gap-1.5">
                <Label htmlFor="custoUnitario">Custo unitário (R$, opcional)</Label>
                <Input
                  id="custoUnitario"
                  type="text"
                  inputMode="decimal"
                  value={custoUnitario}
                  onChange={(e) => setCustoUnitario(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="observacao">Observação (opcional)</Label>
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
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
