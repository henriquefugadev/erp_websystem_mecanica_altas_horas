"use client";

import { useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Rede de segurança das telas internas. Os repositórios usam `throw` no erro do
 * Supabase; sem este arquivo, qualquer instabilidade (ou migração ainda não
 * aplicada) derrubava a Michele na tela de erro crua do Next, sem saída.
 *
 * Aqui ela tem uma frase em português e um botão para tentar de novo. O detalhe
 * técnico fica recolhido — serve para ela ler no telefone para o suporte.
 */
export default function ErroApp({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[erro de tela]", error);
  }, [error]);

  return (
    <div className="mx-auto grid max-w-md gap-4 py-16 text-center">
      <h1 className="font-heading text-2xl">Não foi possível carregar esta tela</h1>
      <p className="text-sm text-muted-foreground">
        Pode ter sido uma instabilidade momentânea na conexão. Tente de novo — se continuar,
        avise o suporte com o código abaixo.
      </p>

      <div className="flex justify-center">
        <Button onClick={reset} className="bg-action text-action-foreground hover:bg-action/90">
          <RefreshCw className="size-4" />
          Tentar de novo
        </Button>
      </div>

      <details className="text-left">
        <summary className="cursor-pointer text-xs text-muted-foreground">
          Detalhes técnicos
        </summary>
        <pre className="mt-2 overflow-x-auto rounded-md bg-muted/50 p-3 text-left text-xs whitespace-pre-wrap">
          {error.digest ? `Código: ${error.digest}\n` : ""}
          {error.message}
        </pre>
      </details>
    </div>
  );
}
