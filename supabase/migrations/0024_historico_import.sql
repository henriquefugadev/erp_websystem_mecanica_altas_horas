-- Importacao do historico da oficina (arquivos do HD antigo).
-- Apenas RASTREABILIDADE: nenhuma tabela de negocio nova. Cada registro
-- importado guarda de qual arquivo/aba ele veio, para poder ser conferido
-- ou desfeito depois. O dado bruto NAO fica no banco (vive nos .xlsx/PDF
-- originais e no historico.json gerado na extracao).

alter table public.cliente          add column if not exists import_origem text;
alter table public.veiculo          add column if not exists import_origem text;
alter table public.ordem_servico    add column if not exists import_origem text,
                                    add column if not exists import_arquivo text;
alter table public.orcamento        add column if not exists import_origem text,
                                    add column if not exists import_arquivo text;
alter table public.conta_financeira add column if not exists import_origem text;

comment on column public.cliente.import_origem is
  'Arquivo/aba de origem quando o registro veio da importacao do historico; null = cadastrado no sistema.';
comment on column public.ordem_servico.import_arquivo is
  'Caminho do arquivo original no Storage (bucket historico), quando houver.';

-- Indices parciais: so as linhas importadas entram, entao custam quase nada
-- e tornam barato listar/limpar o lote inteiro.
create index if not exists cliente_import_idx
  on public.cliente (workshop_id) where import_origem is not null;
create index if not exists ordem_servico_import_idx
  on public.ordem_servico (workshop_id) where import_origem is not null;
