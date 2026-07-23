import { createClient } from "@/lib/supabase/server";
import { getSessaoAtual } from "@/lib/supabase/sessao";
import { buscarConfiguracao } from "@/modules/workshop/data/workshop.repository";
import { hojeSaoPaulo } from "@/lib/format";
import { NovoOrcamentoForm } from "./novo-orcamento-form";

const UM_DIA_MS = 24 * 60 * 60 * 1000;

export default async function NovoOrcamentoPage() {
  const sessao = await getSessaoAtual();
  const supabase = await createClient();
  const workshop = sessao ? await buscarConfiguracao(supabase, sessao.workshopId) : null;

  const hoje = hojeSaoPaulo();
  const validadeDias = workshop?.validade_orcamento_dias ?? 10;
  const validadePadrao = new Date(Date.parse(hoje) + validadeDias * UM_DIA_MS)
    .toISOString()
    .slice(0, 10);

  return (
    <div className="grid max-w-3xl gap-6">
      <h1 className="font-heading text-2xl">Novo orçamento</h1>
      <NovoOrcamentoForm
        condicoesPagamentoPadrao={workshop?.condicoes_pagamento_padrao ?? ""}
        validadePadrao={validadePadrao}
      />
    </div>
  );
}
