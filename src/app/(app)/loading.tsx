import { Skeleton } from "@/components/ui/skeleton";

/**
 * Esqueleto enquanto a tela carrega. O Pátio dispara várias consultas em
 * paralelo; sem isto a navegação ficava "travada" — o navegador segurava a tela
 * antiga sem sinal nenhum de que algo estava acontecendo.
 */
export default function CarregandoApp() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Carregando…</span>
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
