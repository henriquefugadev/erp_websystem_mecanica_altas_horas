"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { estornarPagamentoAction } from "@/modules/financeiro/application/pagamento.actions";

export function EstornarPagamentoButton({
  pagamentoId,
  contaId,
}: {
  pagamentoId: string;
  contaId: string;
}) {
  const [pending, startTransition] = useTransition();

  function estornar() {
    if (!confirm("Estornar este pagamento? A parcela volta a ficar em aberto.")) return;

    startTransition(async () => {
      const resultado = await estornarPagamentoAction(pagamentoId, contaId);
      if (!resultado.ok) {
        toast.error(resultado.erro);
        return;
      }
      toast.success("Pagamento estornado.");
    });
  }

  return (
    <Button variant="ghost" size="sm" disabled={pending} onClick={estornar}>
      <Undo2 className="size-4" />
      Estornar
    </Button>
  );
}
