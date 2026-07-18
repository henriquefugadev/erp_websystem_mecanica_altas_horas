import Link from "next/link";
import { Users } from "lucide-react";
import { logoutAction } from "@/modules/auth/application/auth.actions";
import { Button } from "@/components/ui/button";

export function Sidebar({
  nomeUsuario,
  nomeOficina,
}: {
  nomeUsuario: string;
  nomeOficina: string;
}) {
  return (
    <aside className="flex w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
      <div className="border-b border-white/10 p-4">
        <p className="font-heading text-lg leading-tight">Altas Horas</p>
        <p className="text-xs text-sidebar-foreground/60">{nomeOficina}</p>
      </div>

      <nav className="flex-1 p-2">
        <Link
          href="/clientes"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-white/10"
        >
          <Users className="size-4" />
          Clientes
        </Link>
      </nav>

      <div className="border-t border-white/10 p-3">
        <p className="mb-2 truncate text-xs text-sidebar-foreground/60">
          {nomeUsuario}
        </p>
        <form action={logoutAction}>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="w-full text-sidebar-foreground hover:bg-white/10 hover:text-sidebar-foreground"
          >
            Sair
          </Button>
        </form>
      </div>
    </aside>
  );
}
