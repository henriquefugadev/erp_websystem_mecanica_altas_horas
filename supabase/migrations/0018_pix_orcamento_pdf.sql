-- Dados de recebimento (PIX) da oficina, usados no rodapé do PDF da Ordem de
-- Serviço/orçamento (igual ao modelo em papel que a oficina já usa).
-- Colunas nulas: quem não informar simplesmente não mostra a caixa no PDF.
alter table public.workshop
  add column if not exists chave_pix text,
  add column if not exists pix_favorecido text;

-- Backfill da Mecânica Altas Horas com os dados do modelo em papel (só onde
-- ainda está vazio, para não sobrescrever o que a oficina já tiver ajustado).
-- Multi-tenant seguro: filtra pelo nome, então em outras oficinas não faz nada.
update public.workshop
set
  chave_pix = coalesce(chave_pix, '64996488838'),
  pix_favorecido = coalesce(pix_favorecido, 'MECANICA ALTAS HORAS (NUBANK)')
where unaccent(lower(nome)) like '%altas horas%';
