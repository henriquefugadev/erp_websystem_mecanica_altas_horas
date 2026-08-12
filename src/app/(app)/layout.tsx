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
    // Duas causas diferentes caem aqui. Sem sessão de verdade, o middleware já
    // teria mandado para /login — então, se chegou até este ponto, quase sempre
    // é o outro caso: a pessoa existe no Supabase Auth mas não tem linha em
    // `usuario`/`usuario_workshop`. Antes os dois viravam um redirect mudo, e
    // ela reentrava no loop sem nunca ver o motivo.
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    redirect(user ? "/login?erro=sem-oficina" : "/login");
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
