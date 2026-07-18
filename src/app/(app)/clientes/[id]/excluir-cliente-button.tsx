"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { excluirClienteAction } from "@/modules/crm/application/cliente.actions";

export function ExcluirClienteButton({ clienteId }: { clienteId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function excluir() {
    if (!confirm("Excluir este cliente? Ele deixará de aparecer nas listas."))
      return;

    startTransition(async () => {
      const resultado = await excluirClienteAction(clienteId);
      if (!resultado.ok) {
        toast.error(resultado.erro);
        return;
      }
      toast.success("Cliente excluído.");
      router.push("/clientes");
    });
  }

  return (
    <Button variant="outline" disabled={pending} onClick={excluir}>
      <Trash2 className="size-4 text-alert" />
      Excluir
    </Button>
  );
}
