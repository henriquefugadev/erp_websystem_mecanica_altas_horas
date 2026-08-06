"use client";

import type { DragEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LogIn, RefreshCw } from "lucide-react";
import {
  cancelarOrdemAction,
  iniciarOrdemAction,
  moverGalpaoAction,
  pausarOrdemAction,
  retomarOrdemAction,
  voltarOrdemAction,
} from "@/modules/patio/application/ordem-servico.actions";
import { lotacaoGalpoes, nivelAtencao, transicaoPermitida } from "@/modules/patio/domain/status";
import {
  CAPACIDADE_GALPAO,
  GALPOES,
  STATUS_OS_LABEL,
  type Galpao,
  type OrdemComRelacoes,
} from "@/modules/patio/domain/types";
import type { ValoresConclusao } from "@/modules/patio/data/ordem-servico.repository";
import type { StatusOS } from "@/lib/supabase/database.types";
import { Button } from "@/components/ui/button";
import { OsCard } from "./os-card";
import { NovaOsDialog, type FuncionarioOpcao } from "./nova-os-dialog";
import type { PecaOpcao } from "./usar-peca-dialog";

const COLUNAS: StatusOS[] = ["aguardando", "em_execucao", "parado", "concluido"];

export function KanbanBoard({
  ordens,
  categoriasReceita,
  funcionarios,
  pecas,
  diagnosticoPorOs,
  conclusaoPorOs,
  condicoesPagamento,
}: {
  ordens: OrdemComRelacoes[];
  categoriasReceita: { id: string; nome: string }[];
  funcionarios: FuncionarioOpcao[];
  pecas: PecaOpcao[];
  diagnosticoPorOs: Record<string, number>;
  conclusaoPorOs: Record<string, ValoresConclusao>;
  condicoesPagamento: string | null;
}) {
  const router = useRouter();

  const agora = new Date();
  // 'em_execucao' e 'parado' ocupam vaga física do mesmo jeito — soma os dois
  // pra lotação dos galpões, mostrada uma vez só acima do quadro.
  const lotacao = lotacaoGalpoes(ordens);

  async function iniciar(id: string) {
    const resultado = await iniciarOrdemAction(id);
    if (!resultado.ok) {
      toast.error(resultado.erro);
      return;
    }
    toast.success(
      resultado.data.lotado
        ? `OS iniciada no galpão ${resultado.data.galpao} — esse galpão está no limite de ${CAPACIDADE_GALPAO}.`
        : `OS iniciada no galpão ${resultado.data.galpao}.`
    );
    router.refresh();
  }

  async function voltar(id: string) {
    const resultado = await voltarOrdemAction(id);
    if (!resultado.ok) {
      toast.error(resultado.erro);
      return;
    }
    toast.success("OS voltou para Aguardando.");
    router.refresh();
  }

  async function pausar(id: string) {
    const resultado = await pausarOrdemAction(id);
    if (!resultado.ok) {
      toast.error(resultado.erro);
      return;
    }
    toast.success("OS pausada.");
    router.refresh();
  }

  async function retomar(id: string) {
    const resultado = await retomarOrdemAction(id);
    if (!resultado.ok) {
      toast.error(resultado.erro);
      return;
    }
    toast.success("OS retomada.");
    router.refresh();
  }

  async function cancelar(id: string) {
    const resultado = await cancelarOrdemAction(id);
    if (!resultado.ok) {
      toast.error(resultado.erro);
      return;
    }
    toast.success("OS cancelada.");
    router.refresh();
  }

  async function moverGalpao(id: string, galpao: Galpao) {
    const resultado = await moverGalpaoAction(id, galpao);
    if (!resultado.ok) toast.error(resultado.erro);
    else router.refresh();
  }

  function handleDrop(destino: StatusOS) {
    return (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const raw = e.dataTransfer.getData("text/plain");
      if (!raw) return;

      let origem: { id: string; status: StatusOS };
      try {
        origem = JSON.parse(raw);
      } catch {
        return;
      }
      if (!transicaoPermitida(origem.status, destino)) return;

      if (destino === "em_execucao" && origem.status === "aguardando") void iniciar(origem.id);
      else if (destino === "em_execucao" && origem.status === "parado") void retomar(origem.id);
      else if (destino === "aguardando" && origem.status === "em_execucao") void voltar(origem.id);
      else if (destino === "parado" && origem.status === "em_execucao") void pausar(origem.id);
    };
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-heading text-2xl">Pátio</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Atualizar" onClick={() => router.refresh()}>
            <RefreshCw className="size-4" />
          </Button>
          <Button variant="outline" render={<Link href="/patio/entrada" />}>
            <LogIn className="size-4" />
            Entrada de veículo
          </Button>
          <NovaOsDialog funcionarios={funcionarios} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {GALPOES.map((g) => (
          <span
            key={g}
            className={
              "rounded-full px-2 py-0.5 " +
              (lotacao[g] >= CAPACIDADE_GALPAO
                ? "bg-alert/10 font-medium text-alert"
                : "bg-muted text-muted-foreground")
            }
          >
            Galpão {g}: {lotacao[g]}/{CAPACIDADE_GALPAO}
          </span>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {COLUNAS.map((status) => {
          const ordensColuna = ordens.filter((o) => o.status === status);

          return (
            <div
              key={status}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop(status)}
              className="flex flex-col gap-3 rounded-xl bg-muted/40 p-3"
            >
              <div className="flex items-center justify-between px-1">
                <h2 className="font-heading text-sm tracking-wide text-muted-foreground uppercase">
                  {STATUS_OS_LABEL[status]}
                </h2>
                <span className="text-xs text-muted-foreground">{ordensColuna.length}</span>
              </div>

              <div className="grid gap-2">
                {ordensColuna.length === 0 && (
                  <p className="px-1 text-sm text-muted-foreground">Nenhuma OS aqui.</p>
                )}
                {ordensColuna.map((ordem) => (
                  <OsCard
                    key={ordem.id}
                    ordem={ordem}
                    nivel={nivelAtencao(
                      ordem.status,
                      new Date(ordem.data_abertura),
                      ordem.data_inicio ? new Date(ordem.data_inicio) : null,
                      ordem.data_pausa ? new Date(ordem.data_pausa) : null,
                      agora
                    )}
                    categoriasReceita={categoriasReceita}
                    pecas={pecas}
                    diagnosticoCount={diagnosticoPorOs[ordem.id] ?? 0}
                    valoresConclusao={conclusaoPorOs[ordem.id]}
                    condicoesPagamento={condicoesPagamento}
                    onIniciar={() => void iniciar(ordem.id)}
                    onVoltar={() => void voltar(ordem.id)}
                    onPausar={() => void pausar(ordem.id)}
                    onRetomar={() => void retomar(ordem.id)}
                    onCancelar={() => void cancelar(ordem.id)}
                    onMoverGalpao={(g) => void moverGalpao(ordem.id, g)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
