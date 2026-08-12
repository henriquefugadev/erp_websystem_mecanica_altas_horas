-- Somente leitura: mostra quais migracoes do repositorio o banco JA recebeu.
-- Rode no SQL Editor do Supabase. Nada e alterado.
--
-- Motivo: este banco recebeu migracao manual (sem CLI linkado), entao pode
-- estar atras do repositorio. Foi assim que a 0009 apareceu faltando — o seed
-- do historico estourou em cliente.bairro NOT NULL.

select
  m.migracao,
  m.o_que_faz,
  case when m.presente then 'aplicada' else '>>> FALTANDO <<<' end as situacao
from (
  values
    ('0007', 'ordem_servico.funcionario_id (tecnico virou FK)',
      exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='ordem_servico' and column_name='funcionario_id')),
    ('0009', 'cliente.bairro/cidade/estado passam a aceitar nulo',
      exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='cliente'
                and column_name='bairro' and is_nullable='YES')),
    ('0011', 'orcamento + orcamento_item',
      exists (select 1 from information_schema.tables
              where table_schema='public' and table_name='orcamento_item')),
    ('0012', 'cliente.documento/cep/logradouro/numero aceitam nulo',
      exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='cliente'
                and column_name='documento' and is_nullable='YES')),
    ('0017', 'orcamento_item.tipo_nome + status aguardando_confirmacao',
      exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='orcamento_item' and column_name='tipo_nome')),
    ('0018', 'workshop.chave_pix / pix_favorecido',
      exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='workshop' and column_name='chave_pix')),
    ('0019', 'RPC financeiro_faturamento_por_categoria',
      exists (select 1 from information_schema.routines
              where routine_schema='public' and routine_name='financeiro_faturamento_por_categoria')),
    ('0021', 'ordem_servico.garantia_meses / garantia_ate',
      exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='ordem_servico' and column_name='garantia_ate')),
    ('0022', 'ordem_servico.titulo',
      exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='ordem_servico' and column_name='titulo')),
    ('0023', 'workshop.galpoes_quantidade + tabela servico_catalogo',
      exists (select 1 from information_schema.tables
              where table_schema='public' and table_name='servico_catalogo')),
    ('0024', 'colunas import_origem / import_arquivo',
      exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='cliente' and column_name='import_origem'))
) as m(migracao, o_que_faz, presente)
order by m.migracao;
