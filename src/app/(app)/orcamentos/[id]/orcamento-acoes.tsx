"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Download, MessageCircle, Percent, X } from "lucide-react";
import type { OrcamentoComRelacoes } from "@/modules/orcamento/domain/types";
import { orcamentoTemDesfecho } from "@/modules/orcamento/domain/status";
import {
  cancelarOrcamentoAction,
  marcarOrcamentoEnviadoAction,
  recusarOrcamentoAction,
} from "@/modules/orcamento/application/orcamento.actions";
import { reaplicarMarkupAction } from "@/modules/orcamento/application/cotacao.actions";
import {
  montarLinkWhatsApp,
  montarTextoOrcamento,
} from "@/modules/orcamento/pdf/texto-compartilhamento";
import { Button } from "@/components/ui/button";
import { ResponderOrcamentoDialog } from "./responder-orcamento-dialog";

export function OrcamentoAcoes({ orcamento }: { orcamento: OrcamentoComRelacoes }) {
  const router = useRouter();
  const [processando, setProcessando] = useState(false);
  // Mesma regra que as actions aplicam no servidor (domain/status.ts) — aqui
  // ela só esconde botão; quem barra de verdade é o servidor.
  const podeAgir = !orcamentoTemDesfecho(orcamento.status);

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

  async function reaplicarMarkup() {
    setProcessando(true);
    const resultado = await reaplicarMarkupAction(orcamento.id);
    setProcessando(false);
    if (!resultado.ok) {
      toast.error(resultado.erro);
      return;
    }
    toast.success(
      resultado.data.atualizados > 0
        ? `Markup reaplicado em ${resultado.data.atualizados} item(ns).`
        : "Nenhum item cotado para reaplicar."
    );
    router.refresh();
  }

  // Enviar o orçamento (WhatsApp/PDF) já marca como enviado quando ainda é
  // rascunho — sem depender de a Michele lembrar de clicar em outro botão.
  function marcarEnviadoAoCompartilhar() {
    if (orcamento.status !== "rascunho") return;
    void marcarOrcamentoEnviadoAction(orcamento.id).then((r) => {
      if (r.ok) router.refresh();
    });
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
      {podeAgir && <ResponderOrcamentoDialog orcamento={orcamento} />}
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

      {orcamento.status === "rascunho" && (
        <Button size="sm" variant="outline" disabled={processando} onClick={reaplicarMarkup}>
          <Percent className="size-4" />
          Reaplicar markup
        </Button>
      )}

      <Button
        size="sm"
        variant="outline"
        nativeButton={false}
        onClick={marcarEnviadoAoCompartilhar}
        render={<a href={`/api/orcamentos/${orcamento.id}/pdf`} />}
      >
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
          nativeButton={false}
          onClick={marcarEnviadoAoCompartilhar}
          render={<a href={linkWhatsApp} target="_blank" rel="noopener noreferrer" />}
        >
          <MessageCircle className="size-4" />
          WhatsApp
        </Button>
      )}
    </div>
  );
}
