import { redirect } from "next/navigation";
import { getSessaoAtual } from "@/lib/supabase/sessao";
import { createClient } from "@/lib/supabase/server";
import {
  buscarConfiguracao,
  buscarParametros,
  obterUrlLogo,
} from "@/modules/workshop/data/workshop.repository";
import { listarTiposItemOrcamento } from "@/modules/orcamento/data/tipo-item.repository";
import { listarServicosCatalogo } from "@/modules/servicos/data/servico-catalogo.repository";
import { listarCategorias } from "@/modules/financeiro/data/categoria.repository";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfiguracoesForm } from "./configuracoes-form";
import { ConfiguracoesTipos } from "./configuracoes-tipos";
import { ConfiguracoesServicos } from "./configuracoes-servicos";

// Créditos da equipe que desenvolveu o sistema (GO! JOVEM 2026). Fica no fim
// das Configurações — é o canto "sobre o sistema", fora do caminho do dia a dia.
const DESENVOLVEDORES = [
  { nome: "Henrique Fuga Gomes", telefone: "(16) 99605-1235" },
  { nome: "Murilo de Santana", telefone: "(64) 9204-5152" },
];

export default async function ConfiguracoesPage() {
  const sessao = await getSessaoAtual();
  if (!sessao) redirect("/login");
  // Configurações é restrito ao admin (Jadson) — Michele nem vê o item na
  // sidebar, e mesmo chegando pela URL direta é redirecionada aqui. A escrita
  // já é bloqueada no banco (RLS workshop_update), isso é a camada de UX.
  if (sessao.papel !== "admin") redirect("/financeiro");

  const supabase = await createClient();
  const [workshop, tipos, servicos, categoriasReceita, parametros] = await Promise.all([
    buscarConfiguracao(supabase, sessao.workshopId),
    listarTiposItemOrcamento(supabase),
    listarServicosCatalogo(supabase),
    listarCategorias(supabase, "receita"),
    buscarParametros(supabase, sessao.workshopId),
  ]);
  const logoUrl = workshop.logo_path ? await obterUrlLogo(supabase, workshop.logo_path) : null;

  return (
    <div className="grid max-w-2xl gap-6">
      <h1 className="font-heading text-2xl">Configurações</h1>
      <ConfiguracoesForm
        workshop={workshop}
        logoUrl={logoUrl}
        parametros={parametros}
        categoriasReceita={categoriasReceita}
      />
      <ConfiguracoesTipos tipos={tipos} />
      <ConfiguracoesServicos servicos={servicos} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Desenvolvido por</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {DESENVOLVEDORES.map((dev) => (
            <div
              key={dev.nome}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 text-sm"
            >
              <span className="font-medium">{dev.nome}</span>
              <a
                href={`tel:+55${dev.telefone.replace(/\D/g, "")}`}
                className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                {dev.telefone}
              </a>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
