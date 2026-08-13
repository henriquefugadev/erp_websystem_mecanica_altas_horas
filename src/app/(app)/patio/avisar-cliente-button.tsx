"use client";

import { useState } from "react";
import { toast } from "sonner";
import { BellRing, Check } from "lucide-react";
import { avisarClienteAction } from "@/modules/patio/application/ordem-servico.actions";
import { montarLinkWhatsApp, montarTextoOsPronta } from "@/lib/whatsapp";
import { Button } from "@/components/ui/button";

export function AvisarClienteButton({
  ordemId,
  nome,
  telefone,
  veiculo,
  total,
  condicoes,
  jaAvisado,
}: {
  ordemId: string;
  nome: string | null;
  telefone: string | null;
  veiculo: { placa: string; modelo: string; marca: string | null } | null;
  total: number;
  condicoes: string | null;
  jaAvisado: boolean;
}) {
  const [processando, setProcessando] = useState(false);

  async function registrar() {
    setProcessando(true);
    const resultado = await avisarClienteAction(ordemId);
    setProcessando(false);
    if (!resultado.ok) {
      toast.error(resultado.erro);
      return;
    }
    toast.success("Cliente avisado.");
  }

  if (jaAvisado) {
    return (
      <span className="flex items-center gap-1 text-xs text-fin-entrada">
        <Check className="size-3.5" />
        Avisado
      </span>
    );
  }

  const link = telefone
    ? montarLinkWhatsApp(
        telefone,
        montarTextoOsPronta({
          nome,
          veiculo: veiculo ? { ...veiculo, ano: null } : null,
          total,
          condicoes,
        })
      )
    : null;

  // Com telefone: abre o WhatsApp e já registra o aviso no mesmo clique.
  if (link) {
    return (
      <Button
        size="sm"
        variant="outline"
        nativeButton={false}
        disabled={processando}
        onClick={() => void registrar()}
        render={<a href={link} target="_blank" rel="noopener noreferrer" />}
      >
        <BellRing className="size-4" />
        Avisar que está pronto
      </Button>
    );
  }

  // Sem telefone: só marca como avisado.
  return (
    <Button size="sm" variant="outline" disabled={processando} onClick={() => void registrar()}>
      <BellRing className="size-4" />
      Marcar avisado
    </Button>
  );
}
