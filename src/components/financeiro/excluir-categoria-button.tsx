"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { excluirCategoriaAction } from "@/modules/financeiro/application/categoria.actions";

export function ExcluirCategoriaButton({ categoriaId }: { categoriaId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function excluir() {
    if (!confirm("Excluir esta categoria? Contas já lançadas com ela não são afetadas."))
      return;

    startTransition(async () => {
      const resultado = await excluirCategoriaAction(categoriaId);
      if (!resultado.ok) {
        toast.error(resultado.erro);
        return;
      }
      toast.success("Categoria excluída.");
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
