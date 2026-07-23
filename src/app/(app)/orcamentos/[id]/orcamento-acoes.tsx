"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Copy, Download, MessageCircle, X } from "lucide-react";
import type { OrcamentoComRelacoes } from "@/modules/orcamento/domain/types";
import {
  aprovarOrcamentoAction,
  cancelarOrcamentoAction,
  marcarOrcamentoEnviadoAction,
  recusarOrcamentoAction,
} from "@/modules/orcamento/application/orcamento.actions";
import {
  montarLinkWhatsApp,
  montarTextoOrcamento,
} from "@/modules/orcamento/pdf/texto-compartilhamento";
import { Button } from "@/components/ui/button";

const STATUS_FINAIS = ["aprovado", "aprovado_parcial", "recusado", "cancelado"];

export function OrcamentoAcoes({ orcamento }: { orcamento: OrcamentoComRelacoes }) {
  const router = useRouter();
  const [processando, setProcessando] = useState(false);
  const podeAgir = !STATUS_FINAIS.includes(orcamento.status);

  async function marcarEnviado() {
    setProcessando(true);
    const resultado = await marcarOrcamentoEnviadoAction(orcamento.id);
    setProcessando(false);
    if (!resultado.ok) {
      toast.error(resultado.erro);
      return;
    }
    toast.success("Marcado como enviado.");
    router.refresh();
  }

  async function aprovarTudo() {
    setProcessando(true);
    const resultado = await aprovarOrcamentoAction(
      orcamento.id,
      orcamento.orcamento_item.map((item) => item.id)
    );
    setProcessando(false);
    if (!resultado.ok) {
      toast.error(resultado.erro);
      return;
    }
    toast.success("Orçamento aprovado — OS aberta no Pátio.");
    router.push("/patio");
  }

  async function recusar() {
    setProcessando(true);
    const resultado = await recusarOrcamentoAction(orcamento.id);
    setProcessando(false);
    if (!resultado.ok) {
      toast.error(resultado.erro);
      return;
    }
    toast.success("Orçamento recusado.");
    router.refresh();
  }

  async function cancelar() {
    setProcessando(true);
    const resultado = await cancelarOrcamentoAction(orcamento.id);
    setProcessando(false);
    if (!resultado.ok) {
      toast.error(resultado.erro);
      return;
    }
    toast.success("Orçamento cancelado.");
    router.refresh();
  }

  function copiarTexto() {
    navigator.clipboard.writeText(montarTextoOrcamento(orcamento));
    toast.success("Texto copiado.");
  }

  const linkWhatsApp = orcamento.cliente?.telefone
    ? montarLinkWhatsApp(orcamento.cliente.telefone, montarTextoOrcamento(orcamento))
    : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {podeAgir && orcamento.status === "rascunho" && (
        <Button size="sm" variant="outline" disabled={processando} onClick={marcarEnviado}>
          Marcar como enviado
        </Button>
      )}
      {podeAgir && (
        <Button
          size="sm"
          className="bg-action text-action-foreground hover:bg-action/90"
          disabled={processando}
          onClick={aprovarTudo}
        >
          <Check className="size-4" />
          Aprovar tudo
        </Button>
      )}
      {podeAgir && (
        <Button size="sm" variant="outline" disabled={processando} onClick={recusar}>
          <X className="size-4" />
          Recusar
        </Button>
      )}
      {podeAgir && (
        <Button size="sm" variant="ghost" disabled={processando} onClick={cancelar}>
          Cancelar
        </Button>
      )}

      <Button size="sm" variant="outline" render={<a href={`/api/orcamentos/${orcamento.id}/pdf`} />}>
        <Download className="size-4" />
        Baixar PDF
      </Button>

      <Button size="sm" variant="outline" onClick={copiarTexto}>
        <Copy className="size-4" />
        Copiar texto
      </Button>

      {linkWhatsApp && (
        <Button
          size="sm"
          variant="outline"
          render={<a href={linkWhatsApp} target="_blank" rel="noopener noreferrer" />}
        >
          <MessageCircle className="size-4" />
          WhatsApp
        </Button>
      )}
    </div>
  );
}
