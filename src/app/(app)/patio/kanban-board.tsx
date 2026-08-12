"use client";

import { useMemo, useState } from "react";
import type { DragEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LogIn, RefreshCw } from "lucide-react";
import {
  arquivarOrdemAction,
  cancelarOrdemAction,
  confirmarClienteAction,
  desarquivarOrdemAction,
  enviarConfirmacaoAction,
  iniciarOrdemAction,
  moverGalpaoAction,
  pausarOrdemAction,
  retomarOrdemAction,
  voltarOrdemAction,
} from "@/modules/patio/application/ordem-servico.actions";
import type { ActionResult } from "@/lib/action-result";
import type { TipoItemOrcamento } from "@/modules/orcamento/data/tipo-item.repository";
import type { ServicoCatalogo } from "@/modules/servicos/data/servico-catalogo.repository";
import type { ParametrosPatio } from "@/modules/workshop/domain/parametros";
import { lotacaoGalpoes, nivelAtencao, transicaoPermitida } from "@/modules/patio/domain/status";
import {
  STATUS_OS_LABEL,
  type Galpao,
  type OrdemComRelacoes,
} from "@/modules/patio/domain/types";
import type { ValoresConclusao } from "@/modules/patio/data/ordem-servico.repository";
import type { StatusOS } from "@/lib/supabase/database.types";
import { Button, buttonVariants } from "@/components/ui/button";
import { OsCard } from "./os-card";
import { NovaOsDialog, type FuncionarioOpcao } from "./nova-os-dialog";
import type { PecaOpcao } from "./usar-peca-dialog";

const COLUNAS: StatusOS[] = [
  "aguardando",
  "aguardando_confirmacao",
  "em_execucao",
  "parado",
  "concluido",
];

export function KanbanBoard({
  ordens,
  categoriasReceita,
  funcionarios,
  pecas,
  diagnosticoPorOs,
  conclusaoPorOs,
  condicoesPagamento,
  markup,
  markupHabilitado,
  tipos,
  servicos,
  parametros,
}: {
  ordens: OrdemComRelacoes[];
  categoriasReceita: { id: string; nome: string }[];
  funcionarios: FuncionarioOpcao[];
  pecas: PecaOpcao[];
  diagnosticoPorOs: Record<string, number>;
  conclusaoPorOs: Record<string, ValoresConclusao>;
  condicoesPagamento: string | null;
  markup: number;
  markupHabilitado: boolean;
  tipos: TipoItemOrcamento[];
  servicos: ServicoCatalogo[];
  parametros: ParametrosPatio;
}) {
  const router = useRouter();
  const [orcamentoAbertoPorId, setOrcamentoAbertoPorId] = useState<Record<string, boolean>>({});

  // Uma passada só para montar as 5 colunas, em vez de um filter por coluna.
  // `agora` acompanha os dados: recalcula quando o quadro é recarregado, e não
  // a cada re-render (senão os badges de atenção reavaliavam à toa).
  const { colunas, agora } = useMemo(() => {
    const mapa = new Map<StatusOS, OrdemComRelacoes[]>(COLUNAS.map((s) => [s, []]));
    for (const ordem of ordens) mapa.get(ordem.status)?.push(ordem);
    return { colunas: mapa, agora: new Date() };
  }, [ordens]);

  // 'em_execucao', 'parado' e 'aguardando_confirmacao' ocupam vaga física do
  // mesmo jeito — soma os três pra lotação, mostrada uma vez acima do quadro.
  const lotacao = useMemo(
    () => lotacaoGalpoes(ordens, parametros.galpoes),
    [ordens, parametros.galpoes]
  );

  /**
   * Executa uma action do quadro. O `revalidatePath("/patio")` que toda action
   * faz no servidor já devolve a árvore atualizada junto da resposta — por isso
   * NÃO há `router.refresh()` aqui. Antes havia, e cada clique custava dois
   * recarregamentos completos do quadro (que faz 8 consultas por render).
   */
  async function executar<T>(
    acao: Promise<ActionResult<T>>,
    aoDarCerto: string | ((data: T) => string)
  ) {
    const resultado = await acao;
    if (!resultado.ok) {
      toast.error(resultado.erro);
      return;
    }
    toast.success(
      typeof aoDarCerto === "function" ? aoDarCerto(resultado.data) : aoDarCerto
    );
  }

  const iniciar = (id: string) =>
    executar(iniciarOrdemAction(id), ({ galpao, lotado }) => {
      const nome = parametros.nomesGalpao[galpao - 1] ?? `Galpão ${galpao}`;
      return lotado
        ? `OS iniciada em ${nome} — no limite de ${parametros.capacidadeGalpao}.`
        : `OS iniciada em ${nome}.`;
    });

  const voltar = (id: string) => executar(voltarOrdemAction(id), "OS voltou para Aguardando.");
  const pausar = (id: string) => executar(pausarOrdemAction(id), "OS pausada.");
  const retomar = (id: string) => executar(retomarOrdemAction(id), "OS retomada.");

  // Cancelar e arquivar tiram o card da tela e ficam a um clique dos botões de
  // uso diário. Todo o resto do sistema já confirma antes de uma ação assim
  // (excluir cliente, peça, conta...) — o quadro era a exceção.
  function cancelar(id: string, numero: number) {
    if (!confirm(`Cancelar a OS #${numero}? Ela sai do quadro e não volta a ser executada.`)) {
      return;
    }
    void executar(cancelarOrdemAction(id), "OS cancelada.");
  }

  async function arquivar(id: string, numero: number) {
    if (
      !confirm(
        `Arquivar a OS #${numero}? Ela some do quadro agora, mas continua no histórico do cliente e nos relatórios.`
      )
    ) {
      return;
    }

    const resultado = await arquivarOrdemAction(id);
    if (!resultado.ok) {
      toast.error(resultado.erro);
      return;
    }
    // O card some na hora, então o desfazer vai no próprio aviso — é o único
    // caminho de volta pela interface (a OS arquivada não aparece mais).
    toast.success("OS arquivada — saiu do quadro (segue no histórico).", {
      action: {
        label: "Desfazer",
        onClick: () => void executar(desarquivarOrdemAction(id), "OS de volta no quadro."),
      },
      duration: 8000,
    });
  }

  const enviarConfirmacao = (id: string) =>
    executar(enviarConfirmacaoAction(id), "OS movida para Esperando Confirmação do Cliente.");

  const confirmarCliente = (id: string) =>
    executar(confirmarClienteAction(id), "Cliente aprovou — OS liberada para execução.");

  async function moverGalpao(id: string, galpao: Galpao) {
    const resultado = await moverGalpaoAction(id, galpao);
    if (!resultado.ok) toast.error(resultado.erro);
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
      else if (destino === "em_execucao" && origem.status === "aguardando_confirmacao")
        void confirmarCliente(origem.id);
      else if (destino === "aguardando_confirmacao" && origem.status === "aguardando")
        void enviarConfirmacao(origem.id);
      else if (destino === "aguardando_confirmacao" && origem.status === "em_execucao")
        void enviarConfirmacao(origem.id);
      else if (destino === "aguardando" && origem.status === "em_execucao") void voltar(origem.id);
      else if (destino === "aguardando" && origem.status === "aguardando_confirmacao")
        void voltar(origem.id);
      else if (destino === "parado" && origem.status === "em_execucao") void pausar(origem.id);
    };
  }

  function definirOrcamentoAberto(ordemId: string, aberto: boolean) {
    setOrcamentoAbertoPorId((atual) => ({ ...atual, [ordemId]: aberto }));
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-heading text-2xl">Pátio</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Atualizar"
            onClick={() => router.refresh()}
          >
            <RefreshCw className="size-4" />
          </Button>
          <Link href="/patio/entrada" className={buttonVariants({ variant: "outline" })}>
            <LogIn className="size-4" />
            Entrada de veículo
          </Link>
          <NovaOsDialog funcionarios={funcionarios} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {parametros.galpoes.map((g, i) => (
          <span
            key={g}
            className={
              "rounded-full px-2 py-0.5 " +
              ((lotacao[g] ?? 0) >= parametros.capacidadeGalpao
                ? "bg-alert/10 font-medium text-alert"
                : "bg-muted text-muted-foreground")
            }
          >
            {parametros.nomesGalpao[i]}: {lotacao[g] ?? 0}/{parametros.capacidadeGalpao}
          </span>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {COLUNAS.map((status) => {
          const ordensColuna = colunas.get(status) ?? [];

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
                      agora,
                      parametros
                    )}
                    categoriasReceita={categoriasReceita}
                    funcionarios={funcionarios}
                    pecas={pecas}
                    diagnosticoCount={diagnosticoPorOs[ordem.id] ?? 0}
                    valoresConclusao={conclusaoPorOs[ordem.id]}
                    condicoesPagamento={condicoesPagamento}
                    markup={markup}
                    markupHabilitado={markupHabilitado}
                    tipos={tipos}
                    servicos={servicos}
                    parametros={parametros}
                    onIniciar={() => void iniciar(ordem.id)}
                    onVoltar={() => void voltar(ordem.id)}
                    onPausar={() => void pausar(ordem.id)}
                    onRetomar={() => void retomar(ordem.id)}
                    onCancelar={() => cancelar(ordem.id, ordem.numero)}
                    onEnviarConfirmacao={() => void enviarConfirmacao(ordem.id)}
                    onConfirmarCliente={() => void confirmarCliente(ordem.id)}
                    onMoverGalpao={(g) => void moverGalpao(ordem.id, g)}
                    onArquivar={() => void arquivar(ordem.id, ordem.numero)}
                    orcamentoAberto={orcamentoAbertoPorId[ordem.id] ?? false}
                    onOrcamentoAbertoChange={(aberto) => definirOrcamentoAberto(ordem.id, aberto)}
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
