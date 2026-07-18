import { redirect } from "next/navigation";
import { getSessaoAtual } from "@/lib/supabase/sessao";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { Toaster } from "@/components/ui/sonner";

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
    .select("nome")
    .eq("id", sessao.workshopId)
    .single();

  return (
    <div className="flex min-h-screen">
      <Sidebar
        nomeUsuario={sessao.nome}
        nomeOficina={workshop?.nome ?? ""}
      />
      <main className="flex-1 overflow-x-auto bg-background p-6">
        {children}
      </main>
      <Toaster />
    </div>
  );
}
