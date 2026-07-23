"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { excluirPecaAction } from "@/modules/estoque/application/peca.actions";

export function ExcluirPecaButton({ pecaId }: { pecaId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function excluir() {
    if (!confirm("Excluir esta peça? Ela deixará de aparecer nas listas.")) return;

    startTransition(async () => {
      const resultado = await excluirPecaAction(pecaId);
      if (!resultado.ok) {
        toast.error(resultado.erro);
        return;
      }
      toast.success("Peça excluída.");
      router.push("/estoque");
    });
  }

  return (
    <Button variant="outline" disabled={pending} onClick={excluir}>
      <Trash2 className="size-4 text-alert" />
      Excluir
    </Button>
  );
}
