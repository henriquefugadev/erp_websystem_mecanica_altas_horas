-- Fase (Orçamento): cadastro simples + itens + aprovação manual + geração
-- automática de OS. Corte de MVP conforme docs/pesquisa/05 (o próprio
-- documento classifica versionamento imutável, anexos e assinatura
-- eletrônica como pós-MVP) — aqui é rascunho/enviado/aprovado(parcial)/
-- recusado/cancelado, sem histórico de versões.

-- =========================================================================
-- TABELAS
-- =========================================================================

create table public.orcamento (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshop (id),
  numero integer not null,
  cliente_id uuid not null references public.cliente (id),
  veiculo_id uuid not null references public.veiculo (id),
  queixa text not null,
  observacoes text,
  condicoes_pagamento text,
  status text not null default 'rascunho'
    check (status in ('rascunho', 'enviado', 'aprovado', 'aprovado_parcial', 'recusado', 'cancelado')),
  valor_total numeric(13, 2) not null default 0 check (valor_total >= 0),
  data_emissao date not null default current_date,
  validade date not null,
  enviado_em timestamptz,
  respondido_em timestamptz,
  ordem_servico_id uuid references public.ordem_servico (id),
  created_by uuid references public.usuario (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index orcamento_workshop_status_idx
  on public.orcamento (workshop_id, status)
  where deleted_at is null;
create unique index orcamento_workshop_numero_key
  on public.orcamento (workshop_id, numero);
create index orcamento_cliente_idx on public.orcamento (cliente_id);
create index orcamento_veiculo_idx on public.orcamento (veiculo_id);

create table public.orcamento_item (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshop (id),
  orcamento_id uuid not null references public.orcamento (id) on delete cascade,
  peca_id uuid references public.peca (id),
  tipo text not null check (tipo in ('peca', 'servico')),
  descricao text not null,
  quantidade numeric(13, 3) not null default 1 check (quantidade > 0),
  preco_unitario numeric(13, 2) not null check (preco_unitario >= 0),
  desconto numeric(13, 2) not null default 0 check (desconto >= 0),
  aprovado boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orcamento_item_orcamento_idx on public.orcamento_item (orcamento_id);

alter table public.ordem_servico
  add column orcamento_id uuid references public.orcamento (id);

create index ordem_servico_orcamento_idx
  on public.ordem_servico (orcamento_id)
  where orcamento_id is not null;

-- =========================================================================
-- NUMERAÇÃO SEQUENCIAL POR OFICINA (mesmo padrão de ordem_servico/pedido_compra)
-- =========================================================================

create or replace function app.set_numero_orcamento()
returns trigger
language plpgsql
as $$
declare
  v_proximo integer;
begin
  perform pg_advisory_xact_lock(hashtext(new.workshop_id::text || ':orcamento'));

  select coalesce(max(numero), 0) + 1
  into v_proximo
  from public.orcamento
  where workshop_id = new.workshop_id;

  new.numero := v_proximo;
  return new;
end;
$$;

create trigger orcamento_set_numero
  before insert on public.orcamento
  for each row execute function app.set_numero_orcamento();

-- =========================================================================
-- TRIGGERS updated_at + AUDITORIA (workshop_id de verdade aqui — diferente do
-- caso da tabela workshop — então a função genérica funciona sem adaptação)
-- =========================================================================

create trigger orcamento_set_updated_at
  before update on public.orcamento
  for each row execute function app.set_updated_at();

create trigger orcamento_item_set_updated_at
  before update on public.orcamento_item
  for each row execute function app.set_updated_at();

create trigger orcamento_auditoria
  after insert or update or delete on public.orcamento
  for each row execute function app.registrar_auditoria();

create trigger orcamento_item_auditoria
  after insert or update or delete on public.orcamento_item
  for each row execute function app.registrar_auditoria();

-- =========================================================================
-- ROW LEVEL SECURITY
-- =========================================================================

alter table public.orcamento enable row level security;
alter table public.orcamento force row level security;
alter table public.orcamento_item enable row level security;
alter table public.orcamento_item force row level security;

create policy orcamento_select on public.orcamento
  for select to authenticated
  using (workshop_id in (select app.current_workshop_ids()));

create policy orcamento_insert on public.orcamento
  for insert to authenticated
  with check (workshop_id in (select app.current_workshop_ids()));

create policy orcamento_update on public.orcamento
  for update to authenticated
  using (workshop_id in (select app.current_workshop_ids()))
  with check (workshop_id in (select app.current_workshop_ids()));

create policy orcamento_item_select on public.orcamento_item
  for select to authenticated
  using (workshop_id in (select app.current_workshop_ids()));

create policy orcamento_item_insert on public.orcamento_item
  for insert to authenticated
  with check (workshop_id in (select app.current_workshop_ids()));

-- Update existe porque aprovar_orcamento() precisa marcar `aprovado` por item
-- rodando como o role chamador (nenhuma RPC de negócio deste projeto usa
-- security definer — ver concluir_ordem_servico).
create policy orcamento_item_update on public.orcamento_item
  for update to authenticated
  using (workshop_id in (select app.current_workshop_ids()))
  with check (workshop_id in (select app.current_workshop_ids()));

-- =========================================================================
-- VIEW: status efetivo (expiração computada, sem depender de cron/n8n)
-- =========================================================================

create view public.vw_orcamento as
select
  o.*,
  case
    when o.status = 'enviado' and o.validade < current_date then 'expirado'
    else o.status
  end as status_efetivo
from public.orcamento o
where o.deleted_at is null;

alter view public.vw_orcamento set (security_invoker = on);

-- =========================================================================
-- RPC: cria orçamento + itens numa transação só (cabeçalho + array jsonb,
-- mesmo formato de criar_conta_financeira/concluir_ordem_servico)
-- =========================================================================

create or replace function public.criar_orcamento(
  p_workshop_id uuid,
  p_cliente_id uuid,
  p_veiculo_id uuid,
  p_queixa text,
  p_observacoes text,
  p_condicoes_pagamento text,
  p_validade date,
  p_itens jsonb,
  p_created_by uuid
)
returns uuid
language plpgsql
as $$
declare
  v_orcamento_id uuid;
  v_total numeric(13, 2);
begin
  if p_itens is null or jsonb_array_length(p_itens) = 0 then
    raise exception 'Orçamento precisa de ao menos um item.';
  end if;

  select coalesce(sum(
    (i ->> 'quantidade')::numeric * (i ->> 'preco_unitario')::numeric
      - coalesce((i ->> 'desconto')::numeric, 0)
  ), 0)
  into v_total
  from jsonb_array_elements(p_itens) as i;

  insert into public.orcamento (
    workshop_id, cliente_id, veiculo_id, queixa, observacoes,
    condicoes_pagamento, valor_total, validade, created_by
  ) values (
    p_workshop_id, p_cliente_id, p_veiculo_id, p_queixa, p_observacoes,
    p_condicoes_pagamento, v_total, p_validade, p_created_by
  )
  returning id into v_orcamento_id;

  insert into public.orcamento_item (
    workshop_id, orcamento_id, peca_id, tipo, descricao, quantidade, preco_unitario, desconto
  )
  select
    p_workshop_id,
    v_orcamento_id,
    nullif(i ->> 'peca_id', '')::uuid,
    i ->> 'tipo',
    i ->> 'descricao',
    (i ->> 'quantidade')::numeric,
    (i ->> 'preco_unitario')::numeric,
    coalesce((i ->> 'desconto')::numeric, 0)
  from jsonb_array_elements(p_itens) as i;

  return v_orcamento_id;
end;
$$;

-- =========================================================================
-- RPC: aprova orçamento (total ou parcial conforme os itens informados) e
-- gera a OS vinculada, copiando os itens aprovados na descrição.
-- =========================================================================

create or replace function public.aprovar_orcamento(
  p_orcamento_id uuid,
  p_itens_aprovados uuid[],
  p_created_by uuid
)
returns uuid
language plpgsql
as $$
declare
  v_orcamento record;
  v_total_itens integer;
  v_aprovados_count integer;
  v_novo_status text;
  v_descricao_os text;
  v_ordem_id uuid;
begin
  select * into v_orcamento
  from public.orcamento
  where id = p_orcamento_id
  for update;

  if not found then
    raise exception 'Orçamento não encontrado.';
  end if;

  if v_orcamento.status in ('aprovado', 'aprovado_parcial', 'recusado', 'cancelado') then
    raise exception 'Orçamento já está %, não é possível aprovar.', v_orcamento.status;
  end if;

  if p_itens_aprovados is null or array_length(p_itens_aprovados, 1) = 0 then
    raise exception 'Selecione ao menos um item para aprovar.';
  end if;

  select count(*) into v_total_itens
  from public.orcamento_item
  where orcamento_id = p_orcamento_id;

  update public.orcamento_item
  set aprovado = (id = any(p_itens_aprovados))
  where orcamento_id = p_orcamento_id;

  select count(*) into v_aprovados_count
  from public.orcamento_item
  where orcamento_id = p_orcamento_id and aprovado;

  v_novo_status := case
    when v_aprovados_count = v_total_itens then 'aprovado'
    else 'aprovado_parcial'
  end;

  select string_agg(descricao || ' (x' || quantidade || ')', e'\n' order by created_at)
  into v_descricao_os
  from public.orcamento_item
  where orcamento_id = p_orcamento_id and aprovado;

  insert into public.ordem_servico (
    workshop_id, cliente_id, veiculo_id, queixa, descricao, orcamento_id, created_by
  ) values (
    v_orcamento.workshop_id, v_orcamento.cliente_id, v_orcamento.veiculo_id,
    v_orcamento.queixa,
    'Itens do orçamento #' || v_orcamento.numero || e':\n' || v_descricao_os,
    p_orcamento_id, p_created_by
  )
  returning id into v_ordem_id;

  update public.orcamento
  set status = v_novo_status,
      respondido_em = now(),
      ordem_servico_id = v_ordem_id
  where id = p_orcamento_id;

  return v_ordem_id;
end;
$$;
