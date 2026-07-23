"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { logoutAction } from "@/modules/auth/application/auth.actions";
import type { Papel } from "@/lib/supabase/database.types";
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

export function Sidebar({
  nomeUsuario,
  nomeOficina,
  papel,
}: {
  nomeUsuario: string;
  nomeOficina: string;
  papel: Papel;
}) {
  const pathname = usePathname();
  const activeHref = useActiveHref(pathname);

  const grupos = NAV_GROUPS.map((grupo) => ({
    ...grupo,
    items: grupo.items.filter((item) => !item.adminOnly || papel === "admin"),
  })).filter((grupo) => grupo.items.length > 0);

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
        {grupos.map((grupo, i) => (
          <SidebarGroup key={grupo.label ?? i}>
            {grupo.label && <SidebarGroupLabel>{grupo.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {grupo.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={item.href === activeHref}
                      tooltip={item.label}
                      render={<Link href={item.href} />}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
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
