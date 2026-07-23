"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cancelarPedidoAction } from "@/modules/fornecedores/application/pedido-compra.actions";

export function CancelarPedidoButton({ pedidoId }: { pedidoId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function cancelar() {
    if (!confirm("Cancelar este pedido de compra? O saldo pendente deixa de ser aguardado."))
      return;

    startTransition(async () => {
      const resultado = await cancelarPedidoAction(pedidoId);
      if (!resultado.ok) {
        toast.error(resultado.erro);
        return;
      }
      toast.success("Pedido cancelado.");
      router.refresh();
    });
  }

  return (
    <Button variant="outline" disabled={pending} onClick={cancelar}>
      Cancelar pedido
    </Button>
  );
}
