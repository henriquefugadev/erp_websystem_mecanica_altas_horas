import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { LIMITE_MAXIMO, PAGINA } from "@/lib/paginacao";

/**
 * Rodapé das listagens paginadas: diz quantos registros estão à vista e, se
 * houver mais, leva para a mesma URL pedindo outra página.
 *
 * É um `Link` e não um botão com estado: a listagem inteira é Server Component,
 * então paginar sem JS no cliente mantém a tela leve e o endereço compartilhável.
 */
export function MostrarMais({
  mostrando,
  temMais,
  limite,
  params,
  substantivo,
}: {
  mostrando: number;
  temMais: boolean;
  limite: number;
  /** Os filtros atuais da tela, para não se perderem ao pedir mais linhas. */
  params: Record<string, string | undefined>;
  /** Plural do que está sendo listado: "clientes", "contas", "peças"... */
  substantivo: string;
}) {
  if (!temMais) {
    // Uma lista curta não precisa de rodapé nenhum — só avisa quando o corte
    // existe, para ninguém achar que está vendo tudo quando não está.
    if (mostrando <= PAGINA) return null;
    return (
      <p className="text-center text-sm text-muted-foreground">
        {mostrando} {substantivo} — fim da lista.
      </p>
    );
  }

  const busca = new URLSearchParams();
  for (const [chave, valor] of Object.entries(params)) {
    if (valor) busca.set(chave, valor);
  }

  const proximo = limite + PAGINA;
  const noTeto = proximo > LIMITE_MAXIMO;
  busca.set("mostrar", String(Math.min(proximo, LIMITE_MAXIMO)));

  return (
    <div className="grid justify-items-center gap-1.5">
      {noTeto ? (
        <p className="text-center text-sm text-muted-foreground">
          Mostrando {mostrando} {substantivo}. Há mais registros — use a busca ou os filtros
          acima para chegar no que procura.
        </p>
      ) : (
        <>
          <Link
            href={`?${busca.toString()}`}
            scroll={false}
            className={buttonVariants({ variant: "outline" })}
          >
            <ChevronDown className="size-4" />
            Mostrar mais {substantivo}
          </Link>
          <p className="text-xs text-muted-foreground">
            Mostrando os {mostrando} primeiros.
          </p>
        </>
      )}
    </div>
  );
}
