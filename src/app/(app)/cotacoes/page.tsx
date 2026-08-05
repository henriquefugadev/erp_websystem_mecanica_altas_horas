import { createClient } from "@/lib/supabase/server";
import { getSessaoAtual } from "@/lib/supabase/sessao";
import { listarItensParaCotar } from "@/modules/orcamento/data/cotacao.repository";
import { listarFornecedores } from "@/modules/fornecedores/data/fornecedor.repository";
import { buscarConfiguracao } from "@/modules/workshop/data/workshop.repository";
import { CotacoesForm } from "./cotacoes-form";

export default async function CotacoesPage() {
  const supabase = await createClient();
  const sessao = await getSessaoAtual();

  const [itens, fornecedores, workshop] = await Promise.all([
    listarItensParaCotar(supabase),
    listarFornecedores(supabase, true),
    sessao ? buscarConfiguracao(supabase, sessao.workshopId) : Promise.resolve(null),
  ]);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-heading text-2xl">Cotações</h1>
        <p className="text-sm text-muted-foreground">
          Peças dos orçamentos em rascunho. Defina o fornecedor e o custo — o preço de venda sai
          pelo markup da oficina.
        </p>
      </div>

      <CotacoesForm
        itens={itens}
        fornecedores={fornecedores.map((f) => ({
          id: f.id,
          nome: f.nome,
          telefone: f.telefone,
        }))}
        markup={workshop?.markup_peca_percentual ?? 0}
      />
    </div>
  );
}
