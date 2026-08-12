"use client";

import { Archive, ArrowLeft, ArrowRight, Building2, Clock, FileText, User, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatarData, formatarPlaca, hojeSaoPaulo } from "@/lib/format";
import {
  MOTIVO_PARADA_LABEL,
  type Galpao,
  type OrdemComRelacoes,
} from "@/modules/patio/domain/types";
import { statusPagamento, type NivelAtencao } from "@/modules/patio/domain/status";
import type { ValoresConclusao } from "@/modules/patio/data/ordem-servico.repository";
import type { TipoItemOrcamento } from "@/modules/orcamento/data/tipo-item.repository";
import type { ServicoCatalogo } from "@/modules/servicos/data/servico-catalogo.repository";
import type { ParametrosPatio } from "@/modules/workshop/domain/parametros";
import { ConcluirOsDialog } from "./concluir-os-dialog";
import { EditarOsDialog } from "./editar-os-dialog";
import { OrcamentoDialog } from "./orcamento-dialog";
import type { FuncionarioOpcao } from "./nova-os-dialog";
import { AvisarClienteButton } from "./avisar-cliente-button";
import { ReceberPagamentoDialog } from "./receber-pagamento-dialog";
import { UsarPecaDialog, type PecaOpcao } from "./usar-peca-dialog";

export function OsCard({
  ordem,
  nivel,
  categoriasReceita,
  funcionarios,
  pecas,
  diagnosticoCount,
  valoresConclusao,
  condicoesPagamento,
  markup,
  markupHabilitado,
  tipos,
  servicos,
  parametros,
  onIniciar,
  onVoltar,
  onPausar,
  onRetomar,
  onCancelar,
  onEnviarConfirmacao,
  onConfirmarCliente,
  onMoverGalpao,
  onArquivar,
  orcamentoAberto,
  onOrcamentoAbertoChange,
}: {
  ordem: OrdemComRelacoes;
  nivel: NivelAtencao;
  categoriasReceita: { id: string; nome: string }[];
  funcionarios: FuncionarioOpcao[];
  pecas: PecaOpcao[];
  diagnosticoCount: number;
  valoresConclusao?: ValoresConclusao;
  condicoesPagamento: string | null;
  markup: number;
  markupHabilitado: boolean;
  tipos: TipoItemOrcamento[];
  servicos: ServicoCatalogo[];
  parametros: ParametrosPatio;
  onIniciar: () => void;
  onVoltar: () => void;
  onPausar: () => void;
  onRetomar: () => void;
  onCancelar: () => void;
  onEnviarConfirmacao: () => void;
  onConfirmarCliente: () => void;
  onMoverGalpao: (galpao: Galpao) => void;
  onArquivar: () => void;
  orcamentoAberto: boolean;
  onOrcamentoAbertoChange: (open: boolean) => void;
}) {
  const pagamento = statusPagamento(ordem.conta_financeira);
  const podeReceber =
    ordem.status === "concluido" && (pagamento === "pendente" || pagamento === "parcial");
  const mostraGalpao =
    (ordem.status === "em_execucao" ||
      ordem.status === "parado" ||
      ordem.status === "aguardando_confirmacao") &&
    ordem.galpao !== null;
  const podeOrcar =
    ordem.status === "aguardando" ||
    ordem.status === "aguardando_confirmacao" ||
    ordem.status === "em_execucao" ||
    ordem.status === "parado";
  // Editar dados operacionais (queixa/observações/técnico) faz sentido enquanto
  // a OS está viva; concluída ou cancelada, o registro fica congelado.
  const podeEditar = ordem.status !== "concluido" && ordem.status !== "cancelada";
  const garantiaVigente =
    ordem.garantia_ate !== null && ordem.garantia_ate >= hojeSaoPaulo();
  const nomeVeiculo = ordem.veiculo
    ? `${ordem.veiculo.marca ?? ""} ${ordem.veiculo.modelo}`.trim()
    : "—";
  const placa = ordem.veiculo ? formatarPlaca(ordem.veiculo.placa) : "";

  return (
    <div
      draggable={ordem.status !== "concluido"}
      onDragStart={(e) =>
        e.dataTransfer.setData("text/plain", JSON.stringify({ id: ordem.id, status: ordem.status }))
      }
      className={
        "grid gap-2 rounded-lg bg-card p-3 text-sm ring-1 " +
        (nivel === "atencao" ? "bg-alert/5 ring-alert/40" : "ring-foreground/10")
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <p className="truncate font-heading text-sm leading-tight">
              {ordem.titulo || nomeVeiculo}
            </p>
            {podeEditar && (
              <EditarOsDialog
                ordemId={ordem.id}
                numero={ordem.numero}
                funcionarios={funcionarios}
                tituloInicial={ordem.titulo}
                queixaInicial={ordem.queixa}
                descricaoInicial={ordem.descricao}
                funcionarioIdInicial={ordem.funcionario_id}
              />
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {ordem.titulo
              ? [nomeVeiculo, placa].filter(Boolean).join(" · ")
              : placa}
          </p>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">OS #{ordem.numero}</span>
      </div>

      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <User className="size-3" />
        {ordem.cliente?.nome ?? "—"}
      </p>

      {ordem.funcionario && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Wrench className="size-3" />
          {ordem.funcionario.nome}
        </p>
      )}

      {ordem.queixa ? (
        <p className="line-clamp-2 text-xs">{ordem.queixa}</p>
      ) : (
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="border-action/40 bg-action/10 text-foreground">
            Avaliar
          </Badge>
          <span className="text-xs text-muted-foreground">Cliente não descreveu</span>
        </div>
      )}

      {(diagnosticoCount > 0 || (ordem.status === "parado" && ordem.motivo_parada)) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {diagnosticoCount > 0 && (
            <Badge variant="outline" className="text-muted-foreground">
              Orçamento: {diagnosticoCount} {diagnosticoCount === 1 ? "item" : "itens"}
            </Badge>
          )}
          {ordem.status === "parado" && ordem.motivo_parada && (
            <Badge variant="outline" className="border-alert/30 bg-alert/10 text-alert">
              {MOTIVO_PARADA_LABEL[ordem.motivo_parada]}
            </Badge>
          )}
        </div>
      )}

      {(nivel === "atencao" || pagamento !== "sem_cobranca") && (
        <div className="flex flex-wrap items-center gap-1.5">
          {nivel === "atencao" && (
            <Badge variant="outline" className="border-alert/30 bg-alert/10 text-alert">
              <Clock className="size-3" />
              Atenção
            </Badge>
          )}
          {pagamento === "pago" && (
            <Badge
              variant="outline"
              className="border-fin-entrada/30 bg-fin-entrada/10 text-fin-entrada"
            >
              Pago
            </Badge>
          )}
          {pagamento === "parcial" && (
            <Badge variant="outline" className="text-muted-foreground">
              Pagamento parcial
            </Badge>
          )}
        </div>
      )}

      {mostraGalpao && (
        <div className="flex items-center gap-1.5 text-xs">
          <Building2 className="size-3 text-muted-foreground" />
          <Select
            value={ordem.galpao ? String(ordem.galpao) : undefined}
            onValueChange={(v) => onMoverGalpao(Number(v) as Galpao)}
          >
            <SelectTrigger size="sm" aria-label="Trocar galpão">
              {/* Galpão fora da faixa configurada (a oficina diminuiu a
                  quantidade depois) ainda aparece com o número, para o carro
                  não sumir da tela. */}
              <SelectValue>
                {(v: string) => parametros.nomesGalpao[Number(v) - 1] ?? `Galpão ${v}`}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {parametros.galpoes.map((g, i) => (
                <SelectItem key={g} value={String(g)}>
                  {parametros.nomesGalpao[i]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {ordem.status === "concluido" && ordem.garantia_ate && (
        <Badge
          variant="outline"
          className={
            garantiaVigente
              ? "border-fin-entrada/30 bg-fin-entrada/10 text-fin-entrada"
              : "text-muted-foreground"
          }
        >
          {garantiaVigente
            ? `Garantia até ${formatarData(ordem.garantia_ate)}`
            : `Garantia vencida (${formatarData(ordem.garantia_ate)})`}
        </Badge>
      )}

      <div className="flex flex-wrap gap-2">
        {/* O dialog de orçamento é o mais pesado do quadro (formulário com
            lista dinâmica de itens). Enquanto está fechado, o card mostra só o
            botão — o dialog é montado no primeiro clique. Com 20 OS na tela,
            isso deixa de criar 20 formulários que ninguém abriu. O botão daqui
            é visualmente idêntico ao gatilho que o próprio dialog renderiza. */}
        {podeOrcar &&
          (orcamentoAberto ? (
            <OrcamentoDialog
              ordemId={ordem.id}
              numero={ordem.numero}
              statusOs={ordem.status}
              pecas={pecas}
              markup={markup}
              markupHabilitado={markupHabilitado}
              tipos={tipos}
              servicos={servicos}
              open
              onOpenChange={onOrcamentoAbertoChange}
            />
          ) : (
            <Button size="sm" variant="outline" onClick={() => onOrcamentoAbertoChange(true)}>
              <FileText className="size-4" />
              Orçamento
            </Button>
          ))}
        {ordem.status === "aguardando" && (
          <>
            <Button
              size="sm"
              onClick={onIniciar}
              className="bg-action text-action-foreground hover:bg-action/90"
            >
              Iniciar
            </Button>
            {/* Avança 1 coluna: manda para "Esperando Confirmação do Cliente". */}
            <Button
              size="sm"
              variant="ghost"
              onClick={onEnviarConfirmacao}
              aria-label="Avançar para Esperando Confirmação do Cliente"
              title="Esperando Confirmação do Cliente"
            >
              <ArrowRight className="size-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancelar}>
              Cancelar
            </Button>
          </>
        )}
        {ordem.status === "aguardando_confirmacao" && (
          <>
            {/* Volta 1 coluna: retorna para "Aguardando". */}
            <Button
              size="sm"
              variant="ghost"
              onClick={onVoltar}
              aria-label="Voltar para Aguardando"
              title="Aguardando"
            >
              <ArrowLeft className="size-4" />
            </Button>
            <Button
              size="sm"
              onClick={onConfirmarCliente}
              className="bg-action text-action-foreground hover:bg-action/90"
            >
              Cliente aprovou
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancelar}>
              Cancelar
            </Button>
          </>
        )}
        {ordem.status === "em_execucao" && (
          <>
            {/* Volta 1 coluna: retorna para "Esperando Confirmação do Cliente"
                (antes pulava direto para "Aguardando"). */}
            <Button
              size="sm"
              variant="ghost"
              onClick={onEnviarConfirmacao}
              aria-label="Voltar para Esperando Confirmação do Cliente"
              title="Esperando Confirmação do Cliente"
            >
              <ArrowLeft className="size-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={onPausar}>
              Pausar
            </Button>
            {/* Guarda no ponto de uso: o dialog já devolvia null com a lista
                vazia, mas só depois de montar o formulário. Com o Estoque
                desligado nas Configurações, `pecas` chega vazio e agora nem o
                componente é criado. */}
            {pecas.length > 0 && <UsarPecaDialog ordemId={ordem.id} pecas={pecas} />}
            <ConcluirOsDialog
              ordemId={ordem.id}
              numero={ordem.numero}
              cliente={ordem.cliente}
              veiculo={ordem.veiculo}
              categoriasReceita={categoriasReceita}
              parametros={parametros}
            />
          </>
        )}
        {ordem.status === "concluido" && (
          <>
            <AvisarClienteButton
              ordemId={ordem.id}
              nome={ordem.cliente?.nome ?? null}
              telefone={ordem.cliente?.telefone ?? null}
              veiculo={ordem.veiculo}
              total={(valoresConclusao?.pecas ?? 0) + (valoresConclusao?.servicos ?? 0)}
              condicoes={condicoesPagamento}
              jaAvisado={ordem.cliente_avisado_em !== null}
            />
            {podeReceber && (
              <ReceberPagamentoDialog ordemId={ordem.id} numero={ordem.numero} />
            )}
            {/* Tira a OS do quadro na hora (mesmo efeito da limpeza de N dias,
                sob demanda). Não apaga: continua no histórico e nos relatórios. */}
            <Button
              size="sm"
              variant="ghost"
              onClick={onArquivar}
              title="Arquivar — some do quadro, continua no histórico"
            >
              <Archive className="size-4" />
              Arquivar
            </Button>
          </>
        )}
        {ordem.status === "parado" && (
          <>
            <Button
              size="sm"
              onClick={onRetomar}
              className="bg-action text-action-foreground hover:bg-action/90"
            >
              Retomar
            </Button>
            {/* Guarda no ponto de uso: o dialog já devolvia null com a lista
                vazia, mas só depois de montar o formulário. Com o Estoque
                desligado nas Configurações, `pecas` chega vazio e agora nem o
                componente é criado. */}
            {pecas.length > 0 && <UsarPecaDialog ordemId={ordem.id} pecas={pecas} />}
            <Button size="sm" variant="ghost" onClick={onCancelar}>
              Cancelar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
