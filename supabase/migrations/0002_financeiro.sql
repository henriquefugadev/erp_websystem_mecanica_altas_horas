-- Fase 2: módulo Financeiro (contas a pagar/receber, parcelas, baixas).
-- Regime de caixa: fluxo de caixa é sempre calculado pela data do
-- pagamento (pagamento_financeira.data_pagamento), nunca por emissão ou
-- vencimento. Sem conciliação bancária automática nem motor de juros
-- automático neste MVP (ver docs/pesquisa/10).

-- =========================================================================
-- TABELAS
-- =========================================================================

create table public.categoria_financeira (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshop (id),
  tipo text not null check (tipo in ('receita', 'despesa')),
  nome text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index categoria_financeira_workshop_idx on public.categoria_financeira (workshop_id, tipo)
  where deleted_at is null;
create unique index categoria_financeira_nome_key
  on public.categoria_financeira (workshop_id, tipo, lower(nome))
  where deleted_at is null;

create table public.conta_financeira (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshop (id),
  tipo text not null check (tipo in ('receber', 'pagar')),
  descricao text not null,
  cliente_id uuid references public.cliente (id),
  fornecedor_nome text,
  categoria_id uuid not null references public.categoria_financeira (id),
  valor_total numeric(13, 2) not null check (valor_total > 0),
  data_emissao date not null default current_date,
  status text not null default 'aberta'
    check (status in ('aberta', 'parcial', 'liquidada', 'cancelada')),
  observacoes text,
  created_by uuid references public.usuario (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint conta_financeira_cliente_so_receber
    check (cliente_id is null or tipo = 'receber'),
  constraint conta_financeira_fornecedor_so_pagar
    check (fornecedor_nome is null or tipo = 'pagar')
);

create index conta_financeira_workshop_status_idx
  on public.conta_financeira (workshop_id, tipo, status)
  where deleted_at is null;
create index conta_financeira_cliente_idx on public.conta_financeira (cliente_id)
  where deleted_at is null;

create table public.parcela_financeira (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshop (id),
  conta_id uuid not null references public.conta_financeira (id) on delete cascade,
  numero integer not null check (numero > 0),
  valor numeric(13, 2) not null check (valor > 0),
  vencimento date not null,
  valor_pago numeric(13, 2) not null default 0 check (valor_pago >= 0),
  desconto numeric(13, 2) not null default 0 check (desconto >= 0),
  status text not null default 'aberta'
    check (status in ('aberta', 'parcial', 'liquidada', 'cancelada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint parcela_financeira_pago_nao_excede
    check (valor_pago + desconto <= valor)
);

create unique index parcela_financeira_conta_numero_key
  on public.parcela_financeira (conta_id, numero);
create index parcela_financeira_vencimento_idx
  on public.parcela_financeira (workshop_id, vencimento)
  where status in ('aberta', 'parcial');

create table public.pagamento_financeira (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshop (id),
  parcela_id uuid not null references public.parcela_financeira (id),
  valor numeric(13, 2) not null check (valor > 0),
  desconto numeric(13, 2) not null default 0 check (desconto >= 0),
  data_pagamento date not null default current_date,
  forma_pagamento text not null
    check (forma_pagamento in ('dinheiro', 'cartao_credito', 'cartao_debito', 'pix', 'boleto')),
  observacoes text,
  estornado boolean not null default false,
  estornado_em timestamptz,
  estornado_por uuid references public.usuario (id),
  created_by uuid references public.usuario (id),
  created_at timestamptz not null default now()
);

create index pagamento_financeira_workshop_data_idx
  on public.pagamento_financeira (workshop_id, data_pagamento)
  where estornado = false;
create index pagamento_financeira_parcela_idx on public.pagamento_financeira (parcela_id);

-- =========================================================================
-- TRIGGERS updated_at + AUDITORIA (mesmo padrão de cliente/veiculo)
-- =========================================================================

create trigger categoria_financeira_set_updated_at
  before update on public.categoria_financeira
  for each row execute function app.set_updated_at();

create trigger conta_financeira_set_updated_at
  before update on public.conta_financeira
  for each row execute function app.set_updated_at();

create trigger parcela_financeira_set_updated_at
  before update on public.parcela_financeira
  for each row execute function app.set_updated_at();

create trigger categoria_financeira_auditoria
  after insert or update or delete on public.categoria_financeira
  for each row execute function app.registrar_auditoria();

create trigger conta_financeira_auditoria
  after insert or update or delete on public.conta_financeira
  for each row execute function app.registrar_auditoria();

create trigger parcela_financeira_auditoria
  after insert or update or delete on public.parcela_financeira
  for each row execute function app.registrar_auditoria();

create trigger pagamento_financeira_auditoria
  after insert or update or delete on public.pagamento_financeira
  for each row execute function app.registrar_auditoria();

-- =========================================================================
-- ROW LEVEL SECURITY
-- =========================================================================

alter table public.categoria_financeira enable row level security;
alter table public.categoria_financeira force row level security;
alter table public.conta_financeira enable row level security;
alter table public.conta_financeira force row level security;
alter table public.parcela_financeira enable row level security;
alter table public.parcela_financeira force row level security;
alter table public.pagamento_financeira enable row level security;
alter table public.pagamento_financeira force row level security;

create policy categoria_financeira_select on public.categoria_financeira
  for select to authenticated
  using (workshop_id in (select app.current_workshop_ids()));
create policy categoria_financeira_insert on public.categoria_financeira
  for insert to authenticated
  with check (workshop_id in (select app.current_workshop_ids()));
create policy categoria_financeira_update on public.categoria_financeira
  for update to authenticated
  using (workshop_id in (select app.current_workshop_ids()))
  with check (workshop_id in (select app.current_workshop_ids()));

create policy conta_financeira_select on public.conta_financeira
  for select to authenticated
  using (workshop_id in (select app.current_workshop_ids()));
create policy conta_financeira_insert on public.conta_financeira
  for insert to authenticated
  with check (workshop_id in (select app.current_workshop_ids()));
create policy conta_financeira_update on public.conta_financeira
  for update to authenticated
  using (workshop_id in (select app.current_workshop_ids()))
  with check (workshop_id in (select app.current_workshop_ids()));

create policy parcela_financeira_select on public.parcela_financeira
  for select to authenticated
  using (workshop_id in (select app.current_workshop_ids()));
create policy parcela_financeira_insert on public.parcela_financeira
  for insert to authenticated
  with check (workshop_id in (select app.current_workshop_ids()));
create policy parcela_financeira_update on public.parcela_financeira
  for update to authenticated
  using (workshop_id in (select app.current_workshop_ids()))
  with check (workshop_id in (select app.current_workshop_ids()));

create policy pagamento_financeira_select on public.pagamento_financeira
  for select to authenticated
  using (workshop_id in (select app.current_workshop_ids()));
create policy pagamento_financeira_insert on public.pagamento_financeira
  for insert to authenticated
  with check (workshop_id in (select app.current_workshop_ids()));
create policy pagamento_financeira_update on public.pagamento_financeira
  for update to authenticated
  using (workshop_id in (select app.current_workshop_ids()))
  with check (workshop_id in (select app.current_workshop_ids()));

-- =========================================================================
-- SEED DE CATEGORIAS PADRÃO (reduz cliques na configuração inicial)
-- =========================================================================

create or replace function app.criar_categorias_padrao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.categoria_financeira (workshop_id, tipo, nome) values
    (new.id, 'receita', 'Mão de obra'),
    (new.id, 'receita', 'Peças'),
    (new.id, 'receita', 'Outras receitas'),
    (new.id, 'despesa', 'Compra de peças'),
    (new.id, 'despesa', 'Insumos'),
    (new.id, 'despesa', 'Salários'),
    (new.id, 'despesa', 'Aluguel'),
    (new.id, 'despesa', 'Contas (água, luz, internet)'),
    (new.id, 'despesa', 'Impostos'),
    (new.id, 'despesa', 'Outras despesas');
  return new;
end;
$$;

create trigger workshop_criar_categorias_padrao
  after insert on public.workshop
  for each row execute function app.criar_categorias_padrao();

-- =========================================================================
-- RPCs
-- =========================================================================

-- Cria a conta e suas parcelas atomicamente. security invoker (padrão): RLS
-- de conta_financeira/parcela_financeira continua valendo para quem chama.
create or replace function public.criar_conta_financeira(
  p_workshop_id uuid,
  p_tipo text,
  p_descricao text,
  p_categoria_id uuid,
  p_valor_total numeric,
  p_data_emissao date,
  p_cliente_id uuid,
  p_fornecedor_nome text,
  p_observacoes text,
  p_created_by uuid,
  p_parcelas jsonb -- [{"numero":1,"valor":500.00,"vencimento":"2026-07-15"}, ...]
)
returns uuid
language plpgsql
as $$
declare
  v_conta_id uuid;
  v_soma_parcelas numeric(13, 2);
begin
  select coalesce(sum((p ->> 'valor')::numeric), 0)
  into v_soma_parcelas
  from jsonb_array_elements(p_parcelas) as p;

  if v_soma_parcelas <> p_valor_total then
    raise exception 'A soma das parcelas (%) não bate com o valor total (%).', v_soma_parcelas, p_valor_total;
  end if;

  insert into public.conta_financeira (
    workshop_id, tipo, descricao, categoria_id, valor_total,
    data_emissao, cliente_id, fornecedor_nome, observacoes, created_by
  ) values (
    p_workshop_id, p_tipo, p_descricao, p_categoria_id, p_valor_total,
    p_data_emissao, p_cliente_id, p_fornecedor_nome, p_observacoes, p_created_by
  )
  returning id into v_conta_id;

  insert into public.parcela_financeira (workshop_id, conta_id, numero, valor, vencimento)
  select
    p_workshop_id,
    v_conta_id,
    (p ->> 'numero')::integer,
    (p ->> 'valor')::numeric,
    (p ->> 'vencimento')::date
  from jsonb_array_elements(p_parcelas) as p;

  return v_conta_id;
end;
$$;

-- Registra uma baixa (total ou parcial) numa parcela, atualiza os status
-- de parcela e conta. `for update` trava a parcela contra baixa concorrente.
create or replace function public.registrar_pagamento(
  p_parcela_id uuid,
  p_valor numeric,
  p_desconto numeric,
  p_data_pagamento date,
  p_forma_pagamento text,
  p_observacoes text,
  p_created_by uuid
)
returns uuid
language plpgsql
as $$
declare
  v_parcela record;
  v_saldo numeric(13, 2);
  v_pagamento_id uuid;
  v_novo_pago numeric(13, 2);
  v_novo_desconto numeric(13, 2);
  v_novo_status text;
  v_conta_id uuid;
begin
  select * into v_parcela
  from public.parcela_financeira
  where id = p_parcela_id
  for update;

  if not found then
    raise exception 'Parcela não encontrada.';
  end if;

  if v_parcela.status in ('liquidada', 'cancelada') then
    raise exception 'Parcela já está %, não é possível registrar pagamento.', v_parcela.status;
  end if;

  v_saldo := v_parcela.valor - v_parcela.valor_pago - v_parcela.desconto;

  if p_valor + p_desconto > v_saldo then
    raise exception 'Pagamento de % excede o saldo em aberto de %.', (p_valor + p_desconto), v_saldo;
  end if;

  insert into public.pagamento_financeira (
    workshop_id, parcela_id, valor, desconto, data_pagamento,
    forma_pagamento, observacoes, created_by
  ) values (
    v_parcela.workshop_id, p_parcela_id, p_valor, p_desconto, p_data_pagamento,
    p_forma_pagamento, p_observacoes, p_created_by
  )
  returning id into v_pagamento_id;

  v_novo_pago := v_parcela.valor_pago + p_valor;
  v_novo_desconto := v_parcela.desconto + p_desconto;
  v_novo_status := case
    when v_novo_pago + v_novo_desconto >= v_parcela.valor then 'liquidada'
    when v_novo_pago + v_novo_desconto > 0 then 'parcial'
    else 'aberta'
  end;

  update public.parcela_financeira
  set valor_pago = v_novo_pago, desconto = v_novo_desconto, status = v_novo_status
  where id = p_parcela_id;

  select conta_id into v_conta_id from public.parcela_financeira where id = p_parcela_id;
  perform app.recalcular_status_conta(v_conta_id);

  return v_pagamento_id;
end;
$$;

-- Estorna um pagamento: lançamento compensatório que reabre o saldo da
-- parcela, mantendo o pagamento original intacto para auditoria.
create or replace function public.estornar_pagamento(
  p_pagamento_id uuid,
  p_estornado_por uuid
)
returns void
language plpgsql
as $$
declare
  v_pagamento record;
  v_parcela record;
  v_novo_pago numeric(13, 2);
  v_novo_desconto numeric(13, 2);
  v_novo_status text;
begin
  select * into v_pagamento
  from public.pagamento_financeira
  where id = p_pagamento_id
  for update;

  if not found then
    raise exception 'Pagamento não encontrado.';
  end if;

  if v_pagamento.estornado then
    raise exception 'Pagamento já foi estornado.';
  end if;

  select * into v_parcela
  from public.parcela_financeira
  where id = v_pagamento.parcela_id
  for update;

  update public.pagamento_financeira
  set estornado = true, estornado_em = now(), estornado_por = p_estornado_por
  where id = p_pagamento_id;

  v_novo_pago := v_parcela.valor_pago - v_pagamento.valor;
  v_novo_desconto := v_parcela.desconto - v_pagamento.desconto;
  v_novo_status := case
    when v_novo_pago + v_novo_desconto >= v_parcela.valor then 'liquidada'
    when v_novo_pago + v_novo_desconto > 0 then 'parcial'
    else 'aberta'
  end;

  update public.parcela_financeira
  set valor_pago = v_novo_pago, desconto = v_novo_desconto, status = v_novo_status
  where id = v_parcela.id;

  perform app.recalcular_status_conta(v_parcela.conta_id);
end;
$$;

-- Recalcula o status da conta a partir do status agregado de suas parcelas.
create or replace function app.recalcular_status_conta(p_conta_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
  v_liquidadas integer;
  v_paradas integer; -- parcial ou liquidada
begin
  select
    count(*),
    count(*) filter (where status = 'liquidada'),
    count(*) filter (where status in ('parcial', 'liquidada'))
  into v_total, v_liquidadas, v_paradas
  from public.parcela_financeira
  where conta_id = p_conta_id;

  update public.conta_financeira
  set status = case
    when v_total = 0 then status
    when v_liquidadas = v_total then 'liquidada'
    when v_paradas > 0 then 'parcial'
    else 'aberta'
  end
  where id = p_conta_id
    and status <> 'cancelada';
end;
$$;

-- Fluxo de caixa por dia no período — regime de caixa puro: só considera
-- pagamentos não estornados, pela data_pagamento.
create or replace function public.financeiro_fluxo_caixa(p_de date, p_ate date)
returns table (dia date, entradas numeric, saidas numeric)
language sql
stable
as $$
  select
    pg.data_pagamento as dia,
    coalesce(sum(pg.valor) filter (where cf.tipo = 'receber'), 0) as entradas,
    coalesce(sum(pg.valor) filter (where cf.tipo = 'pagar'), 0) as saidas
  from public.pagamento_financeira pg
  join public.parcela_financeira pf on pf.id = pg.parcela_id
  join public.conta_financeira cf on cf.id = pf.conta_id
  where pg.estornado = false
    and pg.data_pagamento between p_de and p_ate
  group by pg.data_pagamento
  order by pg.data_pagamento
$$;

-- KPIs de resumo para o dashboard.
create or replace function public.financeiro_resumo(p_de date, p_ate date)
returns table (
  total_a_receber numeric,
  total_a_pagar numeric,
  recebido_periodo numeric,
  pago_periodo numeric,
  total_inadimplente numeric
)
language sql
stable
as $$
  select
    coalesce((
      select sum(pf.valor - pf.valor_pago - pf.desconto)
      from public.parcela_financeira pf
      join public.conta_financeira cf on cf.id = pf.conta_id
      where cf.tipo = 'receber' and pf.status in ('aberta', 'parcial')
    ), 0) as total_a_receber,
    coalesce((
      select sum(pf.valor - pf.valor_pago - pf.desconto)
      from public.parcela_financeira pf
      join public.conta_financeira cf on cf.id = pf.conta_id
      where cf.tipo = 'pagar' and pf.status in ('aberta', 'parcial')
    ), 0) as total_a_pagar,
    coalesce((
      select sum(pg.valor)
      from public.pagamento_financeira pg
      join public.parcela_financeira pf on pf.id = pg.parcela_id
      join public.conta_financeira cf on cf.id = pf.conta_id
      where pg.estornado = false and cf.tipo = 'receber'
        and pg.data_pagamento between p_de and p_ate
    ), 0) as recebido_periodo,
    coalesce((
      select sum(pg.valor)
      from public.pagamento_financeira pg
      join public.parcela_financeira pf on pf.id = pg.parcela_id
      join public.conta_financeira cf on cf.id = pf.conta_id
      where pg.estornado = false and cf.tipo = 'pagar'
        and pg.data_pagamento between p_de and p_ate
    ), 0) as pago_periodo,
    coalesce((
      select sum(pf.valor - pf.valor_pago - pf.desconto)
      from public.parcela_financeira pf
      join public.conta_financeira cf on cf.id = pf.conta_id
      where cf.tipo = 'receber' and pf.status in ('aberta', 'parcial')
        and pf.vencimento < current_date
    ), 0) as total_inadimplente
$$;

-- =========================================================================
-- VIEW: inadimplência (parcelas em aberto/parcial já vencidas)
-- =========================================================================

create view public.vw_inadimplencia as
select
  pf.id as parcela_id,
  pf.workshop_id,
  pf.conta_id,
  cf.descricao,
  cf.cliente_id,
  cl.nome as cliente_nome,
  cf.fornecedor_nome,
  cf.tipo,
  pf.numero,
  pf.vencimento,
  (pf.valor - pf.valor_pago - pf.desconto) as saldo,
  (current_date - pf.vencimento) as dias_atraso
from public.parcela_financeira pf
join public.conta_financeira cf on cf.id = pf.conta_id
left join public.cliente cl on cl.id = cf.cliente_id
where pf.status in ('aberta', 'parcial')
  and pf.vencimento < current_date
  and cf.deleted_at is null;

alter view public.vw_inadimplencia set (security_invoker = on);
