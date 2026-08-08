"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { GripVertical } from "lucide-react";
import { logoutAction } from "@/modules/auth/application/auth.actions";
import type { Papel } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sidebar as SidebarPrimitive,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { NAV_GROUPS } from "./nav-items";
import { useNavOrder } from "./use-nav-order";

function useActiveHref(pathname: string) {
  return useMemo(() => {
    const hrefs = NAV_GROUPS.flatMap((grupo) => grupo.items.map((item) => item.href));
    const candidatos = hrefs.filter(
      (href) => pathname === href || pathname.startsWith(`${href}/`)
    );
    // Rota mais específica (href mais longo) vence — evita destacar "Dashboard"
    // (/financeiro) junto de "Contas" (/financeiro/contas) ao mesmo tempo.
    return candidatos.sort((a, b) => b.length - a.length)[0];
  }, [pathname]);
}

type DragState = { groupId: string; href: string } | null;

export function Sidebar({
  nomeUsuario,
  nomeOficina,
  papel,
  navOcultos,
}: {
  nomeUsuario: string;
  nomeOficina: string;
  papel: Papel;
  navOcultos: string[];
}) {
  const pathname = usePathname();
  const activeHref = useActiveHref(pathname);

  const grupos = useMemo(
    () =>
      NAV_GROUPS.map((grupo) => ({
        ...grupo,
        items: grupo.items.filter(
          (item) =>
            (!item.adminOnly || papel === "admin") &&
            // Configurações nunca é ocultável — é de onde se religa o resto.
            (item.href === "/configuracoes" || !navOcultos.includes(item.href))
        ),
      })).filter((grupo) => grupo.items.length > 0),
    [papel, navOcultos]
  );

  const { gruposOrdenados, mover } = useNavOrder(grupos);

  // Item sendo arrastado e item sob o cursor (para desenhar a linha de destino).
  const [drag, setDrag] = useState<DragState>(null);
  const [overHref, setOverHref] = useState<string | null>(null);
  const limparDrag = () => {
    setDrag(null);
    setOverHref(null);
  };

  return (
    <SidebarPrimitive collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center justify-between gap-2 px-1 py-1 group-data-[collapsible=icon]:justify-center">
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate font-heading text-lg leading-tight">Altas Horas</p>
            <p className="truncate text-xs text-sidebar-foreground/60">{nomeOficina}</p>
          </div>
          <SidebarTrigger />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {gruposOrdenados.map((grupo) => (
          <SidebarGroup key={grupo.id}>
            {grupo.label && <SidebarGroupLabel>{grupo.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {grupo.items.map((item) => {
                  const arrastando = drag?.href === item.href;
                  const noMesmoGrupo = drag?.groupId === grupo.id;
                  const alvo = noMesmoGrupo && overHref === item.href && !arrastando;
                  // Linha embaixo quando o item vem de cima (arrasto para baixo),
                  // em cima quando vem de baixo — combina com onde ele vai parar.
                  const dragIdx = grupo.items.findIndex((i) => i.href === drag?.href);
                  const alvoIdx = grupo.items.findIndex((i) => i.href === item.href);
                  const abaixo = dragIdx !== -1 && dragIdx < alvoIdx;

                  return (
                    <SidebarMenuItem
                      key={item.href}
                      onDragOver={(e) => {
                        if (!noMesmoGrupo) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        setOverHref(item.href);
                      }}
                      onDrop={(e) => {
                        if (!noMesmoGrupo || !drag) return;
                        e.preventDefault();
                        mover(grupo.id, drag.href, item.href);
                        limparDrag();
                      }}
                      className={cn(
                        "transition-opacity",
                        arrastando && "opacity-40",
                        alvo &&
                          (abaixo
                            ? "after:pointer-events-none after:absolute after:inset-x-1 after:-bottom-px after:h-0.5 after:rounded-full after:bg-[#F5B400]"
                            : "after:pointer-events-none after:absolute after:inset-x-1 after:-top-px after:h-0.5 after:rounded-full after:bg-[#F5B400]")
                      )}
                    >
                      <SidebarMenuButton
                        isActive={item.href === activeHref}
                        tooltip={item.label}
                        render={<Link href={item.href} draggable={false} />}
                      >
                        <item.icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>

                      {/* Alcinha para arrastar e reordenar. Aparece ao passar o
                          mouse; some no modo recolhido (só ícones). O clique
                          normal no botão continua navegando. */}
                      <span
                        role="button"
                        aria-label={`Reordenar ${item.label}`}
                        title="Arraste para reordenar"
                        draggable
                        onDragStart={(e) => {
                          setDrag({ groupId: grupo.id, href: item.href });
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", item.href);
                        }}
                        onDragEnd={limparDrag}
                        className="absolute top-1/2 right-1 flex size-6 -translate-y-1/2 cursor-grab items-center justify-center rounded text-white opacity-0 transition-opacity group-hover/menu-item:opacity-100 hover:text-black active:cursor-grabbing group-data-[collapsible=icon]:hidden"
                      >
                        <GripVertical className="size-4" />
                      </span>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <p className="truncate px-2 text-xs text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">
          {nomeUsuario}
        </p>
        <form action={logoutAction}>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="w-full justify-center text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0"
          >
            Sair
          </Button>
        </form>
      </SidebarFooter>
    </SidebarPrimitive>
  );
}
