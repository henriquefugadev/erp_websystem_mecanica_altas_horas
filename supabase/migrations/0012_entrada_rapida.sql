-- Fase 1 (fluxo real): destravar a entrada do veículo na recepção.
-- Na prática o cliente chega e larga o carro — muitas vezes a Michele só tem
-- a placa na mão, sem CPF, sem endereço e às vezes sem nem a queixa ("olha
-- aí"). O cadastro atual exige documento válido + endereço e a OS exige
-- queixa, o que torna impossível registrar a entrada em segundos. Aqui:
--   (1) afrouxa os obrigatórios de cliente e a queixa da OS;
--   (2) recria o índice de documento pra conviver com clientes sem documento;
--   (3) adiciona uma busca que também casa por placa/modelo do veículo — que é
--       o único dado que ela costuma ter no balcão.

-- =========================================================================
-- (1) CLIENTE: documento e endereço deixam de ser obrigatórios
-- (bairro/cidade/estado já eram opcionais desde 0009)
-- =========================================================================

alter table public.cliente
  alter column documento drop not null,
  alter column cep drop not null,
  alter column logradouro drop not null,
  alter column numero drop not null;

-- =========================================================================
-- (2) ÍNDICE ÚNICO DE DOCUMENTO: só vale quando há documento de fato.
-- Sem o filtro `documento is not null and <> ''`, dois clientes sem documento
-- colidiriam (string vazia é igual a string vazia num índice único).
-- =========================================================================

drop index if exists public.cliente_workshop_documento_key;
create unique index cliente_workshop_documento_key
  on public.cliente (workshop_id, documento)
  where deleted_at is null and documento is not null and documento <> '';

-- =========================================================================
-- (3) ORDEM DE SERVIÇO: queixa opcional (registrar "olha aí" sem descrição)
-- =========================================================================

alter table public.ordem_servico
  alter column queixa drop not null;

-- =========================================================================
-- (4) BUSCA CLIENTE + VEÍCULO: casa também por placa (normalizada, sem hífen)
-- e por modelo, além de nome/documento/telefone. Retorna o mesmo shape de
-- buscar_clientes (setof cliente) — os veículos são carregados à parte na
-- aplicação. buscar_clientes continua existindo para a listagem de clientes.
-- =========================================================================

create or replace function public.buscar_clientes_veiculos(p_termo text)
returns setof public.cliente
language sql
stable
as $$
  with termo_placa as (
    -- normaliza o termo do mesmo jeito que o front normaliza a placa antes de
    -- gravar: remove tudo que não é letra/dígito e sobe pra maiúscula.
    select upper(regexp_replace(coalesce(p_termo, ''), '[^A-Za-z0-9]', '', 'g')) as placa
  )
  select distinct c.*
  from public.cliente c
  left join public.veiculo v
    on v.cliente_id = c.id and v.deleted_at is null
  cross join termo_placa t
  where c.deleted_at is null
    and (
      unaccent(c.nome) ilike unaccent('%' || p_termo || '%')
      or c.documento ilike '%' || p_termo || '%'
      or c.telefone ilike '%' || p_termo || '%'
      or (t.placa <> '' and v.placa ilike '%' || t.placa || '%')
      or unaccent(v.modelo) ilike unaccent('%' || p_termo || '%')
    )
  order by c.nome
$$;
