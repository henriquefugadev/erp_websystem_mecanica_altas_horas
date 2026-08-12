-- ============================================================================
-- DESFAZ a importacao do historico. Apaga SOMENTE o que veio dela
-- (import_origem is not null) — nada criado pela oficina no sistema e tocado.
--
-- Use quando o seed parar no meio (o SQL Editor pode quebrar script grande,
-- e ai o BEGIN/COMMIT nao vale como unidade) e voce quiser recomecar limpo.
--
-- A auditoria registra os DELETE, entao a remocao tambem fica rastreada.
-- ============================================================================
begin;

-- Confira ANTES o que vai sair:
select 'cliente' as tabela, count(*) from public.cliente where import_origem is not null
union all select 'veiculo', count(*) from public.veiculo where import_origem is not null
union all select 'ordem_servico', count(*) from public.ordem_servico where import_origem is not null
union all select 'orcamento', count(*) from public.orcamento where import_origem is not null
union all select 'conta_financeira', count(*) from public.conta_financeira where import_origem is not null;

-- Ordem ditada pelas FKs, de baixo para cima.
delete from public.pagamento_financeira pg
 using public.parcela_financeira p, public.conta_financeira cf
 where p.id = pg.parcela_id and cf.id = p.conta_id and cf.import_origem is not null;

delete from public.parcela_financeira p
 using public.conta_financeira cf
 where cf.id = p.conta_id and cf.import_origem is not null;

delete from public.conta_financeira where import_origem is not null;

delete from public.orcamento_item oi
 using public.orcamento o
 where o.id = oi.orcamento_id and o.import_origem is not null;

-- orcamento e ordem_servico se apontam mutuamente (orcamento.ordem_servico_id
-- e ordem_servico.orcamento_id): corta um lado antes de apagar.
update public.ordem_servico set orcamento_id = null where import_origem is not null;

delete from public.orcamento where import_origem is not null;
delete from public.ordem_servico where import_origem is not null;
delete from public.veiculo where import_origem is not null;
delete from public.cliente where import_origem is not null;

-- Funcionarios criados pelo import (os que assinavam as planilhas). So saem se
-- nenhuma OS viva ainda os referenciar.
delete from public.funcionario f
 where f.observacoes = 'Importado do historico (assinava SERVICO FEITO POR nas planilhas).'
   and not exists (select 1 from public.ordem_servico os where os.funcionario_id = f.id);

-- Deve voltar tudo zerado:
select 'cliente' as tabela, count(*) from public.cliente where import_origem is not null
union all select 'veiculo', count(*) from public.veiculo where import_origem is not null
union all select 'ordem_servico', count(*) from public.ordem_servico where import_origem is not null
union all select 'orcamento', count(*) from public.orcamento where import_origem is not null
union all select 'conta_financeira', count(*) from public.conta_financeira where import_origem is not null;

commit;
