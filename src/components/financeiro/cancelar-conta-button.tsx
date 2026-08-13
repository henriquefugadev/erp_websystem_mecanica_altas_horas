"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cancelarContaAction } from "@/modules/financeiro/application/conta.actions";

export function CancelarContaButton({ contaId }: { contaId: string }) {
  const [pending, startTransition] = useTransition();

  function cancelar() {
    if (
      !confirm(
        "Cancelar esta conta? As parcelas em aberto deixarão de exigir pagamento."
      )
    )
      return;

    startTransition(async () => {
      const resultado = await cancelarContaAction(contaId);
      if (!resultado.ok) {
        toast.error(resultado.erro);
        return;
      }
      toast.success("Conta cancelada.");
    });
  }

  return (
    <Button variant="outline" disabled={pending} onClick={cancelar}>
      <Ban className="size-4 text-alert" />
      Cancelar conta
    </Button>
  );
}
