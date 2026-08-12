-- Dois índices nas consultas que mais crescem com o uso.
--
-- O Postgres NÃO cria índice sozinho em coluna de chave estrangeira (só no lado
-- referenciado). As duas colunas abaixo são FKs muito consultadas e estavam sem
-- índice — o que só ficou visível depois da importação do histórico da oficina,
-- que multiplicou as linhas dessas tabelas.

-- Histórico do cliente (aba no perfil, buscarHistoricoDoCliente): filtra
-- ordem_servico por cliente_id. Sem índice era varredura da tabela inteira a
-- cada abertura de um cliente. Parcial em deleted_at porque toda consulta do
-- histórico ignora OS excluída — índice menor e mais barato de manter.
create index if not exists ordem_servico_cliente_idx
  on public.ordem_servico (cliente_id)
  where deleted_at is null;

-- Parcelas de uma conta: usado ao abrir o detalhe da conta, ao cancelar/excluir
-- (que atualizam as parcelas em aberto) e pela receber_parcelas_da_os (0026).
create index if not exists parcela_financeira_conta_idx
  on public.parcela_financeira (conta_id);
