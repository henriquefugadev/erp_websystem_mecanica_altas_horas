"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { excluirFornecedorAction } from "@/modules/fornecedores/application/fornecedor.actions";

export function ExcluirFornecedorButton({ fornecedorId }: { fornecedorId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function excluir() {
    if (!confirm("Excluir este fornecedor? Ele deixará de aparecer nas listas.")) return;

    startTransition(async () => {
      const resultado = await excluirFornecedorAction(fornecedorId);
      if (!resultado.ok) {
        toast.error(resultado.erro);
        return;
      }
      toast.success("Fornecedor excluído.");
      router.push("/fornecedores");
    });
  }

  return (
    <Button variant="outline" disabled={pending} onClick={excluir}>
      <Trash2 className="size-4 text-alert" />
      Excluir
    </Button>
  );
}
