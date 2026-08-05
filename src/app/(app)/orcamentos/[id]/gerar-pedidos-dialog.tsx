"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShoppingCart, AlertTriangle } from "lucide-react";
import type { ResumoPedidos } from "@/modules/fornecedores/data/pedido-compra.repository";
import { gerarPedidosDoOrcamentoAction } from "@/modules/fornecedores/application/pedido-compra.actions";
import { formatarDinheiro } from "@/lib/format";
import { Button } from "@/components/ui/button";
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

interface Categoria {
  id: string;
  nome: string;
}

function categoriaSugerida(categorias: Categoria[]): string {
  const preferida = categorias.find((c) => /pe[çc]a|compra/i.test(c.nome));
  return preferida?.id ?? categorias[0]?.id ?? "";
}

export function GerarPedidosDialog({
  orcamentoId,
  resumo,
  categorias,
}: {
  orcamentoId: string;
  resumo: ResumoPedidos;
  categorias: Categoria[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [categoriaId, setCategoriaId] = useState(() => categoriaSugerida(categorias));

  // Nada a comprar (sem grupos) e nada já gerado → não mostra o botão.
  if (resumo.grupos.length === 0 && !resumo.jaGerado) return null;

  if (resumo.jaGerado) {
    return (
      <Button size="sm" variant="outline" disabled>
        <ShoppingCart className="size-4" />
        Pedidos já gerados
      </Button>
    );
  }

  async function gerar() {
    setEnviando(true);
    try {
      const resultado = await gerarPedidosDoOrcamentoAction(orcamentoId, categoriaId);
      if (!resultado.ok) {
        toast.error(resultado.erro);
        return;
      }
      toast.success(
        `${resultado.data.quantidade} pedido(s) de compra gerado(s) — veja em Compras.`
      );
      setOpen(false);
      router.push("/compras");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button size="sm" className="bg-action text-action-foreground hover:bg-action/90" />}
      >
        <ShoppingCart className="size-4" />
        Gerar pedidos de compra
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gerar pedidos de compra</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Um pedido por fornecedor, com os custos cotados:
        </p>

        <div className="grid gap-2">
          {resumo.grupos.map((g) => (
            <div
              key={g.fornecedorId}
              className="flex items-center justify-between rounded-md border p-2 text-sm"
            >
              <span>
                {g.fornecedorNome}{" "}
                <span className="text-muted-foreground">
                  · {g.itens} {g.itens === 1 ? "item" : "itens"}
                </span>
              </span>
              <span className="font-medium">{formatarDinheiro(g.total)}</span>
            </div>
          ))}
        </div>

        {resumo.itensSemFornecedor > 0 && (
          <div className="flex items-center gap-2 rounded-md border border-alert/30 bg-alert/10 p-2 text-xs text-alert">
            <AlertTriangle className="size-4 shrink-0" />
            {resumo.itensSemFornecedor}{" "}
            {resumo.itensSemFornecedor === 1 ? "peça aprovada ficará de fora" : "peças aprovadas ficarão de fora"}{" "}
            (sem fornecedor ou custo). Defina em Cotações e gere de novo.
          </div>
        )}

        <div className="grid gap-1.5">
          <Label htmlFor="categoria" required>
            Categoria (despesa)
          </Label>
          <Select value={categoriaId} onValueChange={(v) => setCategoriaId(v ?? "")}>
            <SelectTrigger id="categoria">
              <SelectValue placeholder="Selecione">
                {(v: string) => categorias.find((c) => c.id === v)?.nome ?? "Selecione"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {categorias.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button
            disabled={enviando || !categoriaId || resumo.grupos.length === 0}
            onClick={gerar}
            className="bg-action text-action-foreground hover:bg-action/90"
          >
            Gerar {resumo.grupos.length} pedido(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
