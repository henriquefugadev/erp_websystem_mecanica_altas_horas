"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { excluirContaAction } from "@/modules/financeiro/application/conta.actions";

// Excluir de vez uma conta lançada por engano ou de teste. Diferente de
// "Cancelar" (que mantém a conta na lista com status Cancelada), aqui ela some
// da tela. O registro continua no banco (soft-delete) — dá para recuperar via
// suporte se preciso.
export function ExcluirContaButton({ contaId }: { contaId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function excluir() {
    if (
      !confirm(
        "Excluir esta conta? Ela sai da lista e do financeiro. Use para remover lançamentos de teste ou feitos por engano."
      )
    )
      return;

    startTransition(async () => {
      const resultado = await excluirContaAction(contaId);
      if (!resultado.ok) {
        toast.error(resultado.erro);
        return;
      }
      toast.success("Conta excluída.");
      // O detalhe desta conta passa a devolver 404 (a query filtra deleted_at),
      // então voltamos para a lista.
      router.push("/financeiro/contas");
    });
  }

  return (
    <Button variant="outline" disabled={pending} onClick={excluir}>
      <Trash2 className="size-4 text-alert" />
      Excluir
    </Button>
  );
}
