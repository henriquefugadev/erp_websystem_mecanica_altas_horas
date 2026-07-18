-- Backfill: oficinas criadas antes de 0002_financeiro.sql não passaram pela
-- trigger app.criar_categorias_padrao (ela só dispara em INSERT em
-- public.workshop). Idempotente: só insere para quem ainda não tem
-- nenhuma categoria cadastrada.
insert into public.categoria_financeira (workshop_id, tipo, nome)
select w.id, cat.tipo, cat.nome
from public.workshop w
cross join (values
  ('receita', 'Mão de obra'),
  ('receita', 'Peças'),
  ('receita', 'Outras receitas'),
  ('despesa', 'Compra de peças'),
  ('despesa', 'Insumos'),
  ('despesa', 'Salários'),
  ('despesa', 'Aluguel'),
  ('despesa', 'Contas (água, luz, internet)'),
  ('despesa', 'Impostos'),
  ('despesa', 'Outras despesas')
) as cat(tipo, nome)
where not exists (
  select 1 from public.categoria_financeira cf where cf.workshop_id = w.id
);
