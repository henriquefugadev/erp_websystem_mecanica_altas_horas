"use client";

import { ArrowLeft, Building2, Clock, User, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatarPlaca } from "@/lib/format";
import { GALPOES, type Galpao, type OrdemComRelacoes } from "@/modules/patio/domain/types";
import { statusPagamento, type NivelAtencao } from "@/modules/patio/domain/status";
import { ConcluirOsDialog } from "./concluir-os-dialog";
import { UsarPecaDialog, type PecaOpcao } from "./usar-peca-dialog";

export function OsCard({
  ordem,
  nivel,
  categoriasReceita,
  pecas,
  onIniciar,
  onVoltar,
  onPausar,
  onRetomar,
  onCancelar,
  onMoverGalpao,
}: {
  ordem: OrdemComRelacoes;
  nivel: NivelAtencao;
  categoriasReceita: { id: string; nome: string }[];
  pecas: PecaOpcao[];
  onIniciar: () => void;
  onVoltar: () => void;
  onPausar: () => void;
  onRetomar: () => void;
  onCancelar: () => void;
  onMoverGalpao: (galpao: Galpao) => void;
}) {
  const pagamento = statusPagamento(ordem.conta_financeira);
  const mostraGalpao = ordem.status === "em_execucao" || ordem.status === "parado";

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
        <div>
          <p className="font-heading text-sm leading-tight">
            {ordem.veiculo ? `${ordem.veiculo.marca ?? ""} ${ordem.veiculo.modelo}`.trim() : "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            {ordem.veiculo ? formatarPlaca(ordem.veiculo.placa) : ""}
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

      <p className="line-clamp-2 text-xs">{ordem.queixa}</p>

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
              <SelectValue>{(v: string) => `Galpão ${v}`}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {GALPOES.map((g) => (
                <SelectItem key={g} value={String(g)}>
                  Galpão {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {ordem.status === "aguardando" && (
          <>
            <Button
              size="sm"
              onClick={onIniciar}
              className="bg-action text-action-foreground hover:bg-action/90"
            >
              Iniciar
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancelar}>
              Cancelar
            </Button>
          </>
        )}
        {ordem.status === "em_execucao" && (
          <>
            <Button size="sm" variant="ghost" onClick={onVoltar} aria-label="Voltar para aguardando">
              <ArrowLeft className="size-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={onPausar}>
              Pausar
            </Button>
            <UsarPecaDialog ordemId={ordem.id} pecas={pecas} />
            <ConcluirOsDialog
              ordemId={ordem.id}
              numero={ordem.numero}
              categoriasReceita={categoriasReceita}
            />
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
            <UsarPecaDialog ordemId={ordem.id} pecas={pecas} />
            <Button size="sm" variant="ghost" onClick={onCancelar}>
              Cancelar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
