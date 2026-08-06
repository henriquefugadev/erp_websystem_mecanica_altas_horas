import Link from "next/link";
import { ChevronRight, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { carregarPainel } from "@/modules/painel/data/painel.repository";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function PainelPage() {
  const supabase = await createClient();
  const blocos = await carregarPainel(supabase);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-heading text-2xl">O que fazer agora</h1>
        <p className="text-sm text-muted-foreground">
          Suas pendências do momento. Resolva de cima para baixo até zerar.
        </p>
      </div>

      {blocos.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <CheckCircle2 className="size-10 text-fin-entrada" />
          <p className="font-heading text-lg">Nada pendente.</p>
          <p className="text-sm text-muted-foreground">Tudo em dia por aqui.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {blocos.map((bloco) => (
            <Card key={bloco.chave}>
              <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
                <CardTitle className="font-heading text-base">{bloco.titulo}</CardTitle>
                <Badge variant="outline">{bloco.total}</Badge>
              </CardHeader>
              <CardContent className="grid gap-1">
                {bloco.linhas.map((linha) => (
                  <Link
                    key={linha.chave}
                    href={linha.href}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{linha.primario}</p>
                      {linha.secundario && (
                        <p className="truncate text-xs text-muted-foreground">{linha.secundario}</p>
                      )}
                    </div>
                    <span className="flex shrink-0 items-center gap-0.5 text-xs font-medium text-action">
                      {bloco.acao}
                      <ChevronRight className="size-3.5" />
                    </span>
                  </Link>
                ))}
                {bloco.total > bloco.linhas.length && (
                  <p className="px-2 pt-1 text-xs text-muted-foreground">
                    + {bloco.total - bloco.linhas.length} a mais
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
