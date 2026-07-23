import { redirect } from "next/navigation";
import { getSessaoAtual } from "@/lib/supabase/sessao";
import { createClient } from "@/lib/supabase/server";
import { buscarConfiguracao, obterUrlLogo } from "@/modules/workshop/data/workshop.repository";
import { ConfiguracoesForm } from "./configuracoes-form";

export default async function ConfiguracoesPage() {
  const sessao = await getSessaoAtual();
  if (!sessao) redirect("/login");
  // Configurações é restrito ao admin (Jadson) — Michele nem vê o item na
  // sidebar, e mesmo chegando pela URL direta é redirecionada aqui. A escrita
  // já é bloqueada no banco (RLS workshop_update), isso é a camada de UX.
  if (sessao.papel !== "admin") redirect("/financeiro");

  const supabase = await createClient();
  const workshop = await buscarConfiguracao(supabase, sessao.workshopId);
  const logoUrl = workshop.logo_path ? await obterUrlLogo(supabase, workshop.logo_path) : null;

  return (
    <div className="grid max-w-2xl gap-6">
      <h1 className="font-heading text-2xl">Configurações</h1>
      <ConfiguracoesForm workshop={workshop} logoUrl={logoUrl} />
    </div>
  );
}
