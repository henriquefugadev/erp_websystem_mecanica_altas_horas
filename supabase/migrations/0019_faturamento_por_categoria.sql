-- Faturamento (contas a receber emitidas no período) agrupado por categoria.
-- Alimenta o painel do dashboard que separa peças de mão de obra/serviço.
-- security invoker + RLS das tabelas base garantem o recorte por oficina, igual
-- a financeiro_resumo/financeiro_fluxo_caixa.
create or replace function public.financeiro_faturamento_por_categoria(p_de date, p_ate date)
returns table (categoria_id uuid, categoria_nome text, total numeric)
language sql
stable
as $$
  select
    cf.categoria_id,
    cat.nome as categoria_nome,
    coalesce(sum(cf.valor_total), 0) as total
  from public.conta_financeira cf
  join public.categoria_financeira cat on cat.id = cf.categoria_id
  where cf.tipo = 'receber'
    and cf.status <> 'cancelada'
    and cf.deleted_at is null
    and cf.data_emissao between p_de and p_ate
  group by cf.categoria_id, cat.nome
  order by total desc
$$;
