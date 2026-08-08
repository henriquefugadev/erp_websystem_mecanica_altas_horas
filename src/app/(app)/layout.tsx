import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessaoAtual } from "@/lib/supabase/sessao";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessao = await getSessaoAtual();

  if (!sessao) {
    redirect("/login");
  }

  const supabase = await createClient();
  const { data: workshop } = await supabase
    .from("workshop")
    .select("nome, nav_ocultos")
    .eq("id", sessao.workshopId)
    .single();

  const cookieStore = await cookies();
  const sidebarAberta = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={sidebarAberta}>
      <Sidebar
        nomeUsuario={sessao.nome}
        nomeOficina={workshop?.nome ?? ""}
        papel={sessao.papel}
        navOcultos={workshop?.nav_ocultos ?? []}
      />
      <SidebarInset className="overflow-x-auto p-6">
        {children}
      </SidebarInset>
      <Toaster />
    </SidebarProvider>
  );
}
