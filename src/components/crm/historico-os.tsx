import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatarData, formatarDinheiro, formatarPlaca } from "@/lib/format";
import { STATUS_OS_LABEL } from "@/modules/patio/domain/types";
import type { HistoricoOs } from "@/modules/patio/domain/historico";

// Histórico completo de OS do cliente (todos os veículos), com o que foi feito
// e o valor. Somente leitura, montado no servidor.
export function HistoricoOsCliente({ historico }: { historico: HistoricoOs[] }) {
  if (historico.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma ordem de serviço registrada para este cliente ainda.
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      {historico.map((os) => (
        <Card key={os.id}>
          <CardHeader className="grid gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-heading text-base">OS #{os.numero}</span>
                <Badge variant="outline">{STATUS_OS_LABEL[os.status]}</Badge>
                {!os.aprovado && os.itens.length > 0 && (
                  <Badge variant="outline" className="text-muted-foreground">
                    Orçamento (não aprovado)
                  </Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                Aberta em {formatarData(os.dataAbertura)}
                {os.dataConclusao ? ` · Concluída em ${formatarData(os.dataConclusao)}` : ""}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {os.veiculo && (
                <span>
                  {os.veiculo.nome}
                  {os.veiculo.cor ? ` · ${os.veiculo.cor}` : ""} · {formatarPlaca(os.veiculo.placa)}
                </span>
              )}
              {os.funcionario && <span>Mecânico: {os.funcionario}</span>}
            </div>
            {os.queixa && <p className="text-sm">{os.queixa}</p>}
          </CardHeader>
          <CardContent>
            {os.itens.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem itens registrados.</p>
            ) : (
              <div className="grid gap-1 text-sm">
                {os.itens.map((item, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 border-b py-1">
                    <span>
                      {item.quantidade > 1 ? `${item.quantidade}× ` : ""}
                      {item.descricao}
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({item.tipo === "peca" ? "Peça" : "Serviço"})
                      </span>
                    </span>
                    <span className="tabular-nums">{formatarDinheiro(item.subtotal)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-1 font-medium">
                  <span>Total</span>
                  <span className="tabular-nums">{formatarDinheiro(os.total)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
