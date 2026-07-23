"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { excluirFuncionarioAction } from "@/modules/funcionarios/application/funcionario.actions";

export function ExcluirFuncionarioButton({ funcionarioId }: { funcionarioId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function excluir() {
    if (!confirm("Excluir este funcionário? OS já lançadas com ele não são afetadas.")) return;

    startTransition(async () => {
      const resultado = await excluirFuncionarioAction(funcionarioId);
      if (!resultado.ok) {
        toast.error(resultado.erro);
        return;
      }
      toast.success("Funcionário excluído.");
      router.refresh();
    });
  }

  return (
    <Button variant="ghost" size="icon-sm" disabled={pending} onClick={excluir}>
      <Trash2 className="size-4 text-alert" />
      <span className="sr-only">Excluir</span>
    </Button>
  );
}
