import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STATUS_LABEL, type StatusExibicao } from "@/modules/financeiro/domain/types";

const ESTILOS: Record<StatusExibicao, string> = {
  aberta: "border-border text-foreground",
  parcial: "border-border bg-muted text-foreground",
  liquidada: "border-fin-entrada/30 bg-fin-entrada/10 text-fin-entrada",
  cancelada: "border-border text-muted-foreground",
  vencida: "border-alert/30 bg-alert/10 text-alert",
};

export function StatusBadge({
  status,
  className,
}: {
  status: StatusExibicao;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn(ESTILOS[status], className)}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}
