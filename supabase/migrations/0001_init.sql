-- Fase 1: fundação multi-tenant + módulo CRM (cliente/veículo)
-- Modelo: banco compartilhado, isolamento por workshop_id + Row Level Security.
-- Ver docs/pesquisa/13, 14, 15.

-- gen_random_uuid() é nativo do Postgres (core desde a v13); nenhuma
-- extensão adicional é necessária para UUIDs.
-- unaccent viabiliza busca de cliente/veículo tolerante a acento (ex: "Joao" encontra "João").
create extension if not exists unaccent;

create schema if not exists app;

-- =========================================================================
-- TABELAS
-- =========================================================================

create table public.workshop (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  fuso_horario text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Perfil de aplicação 1:1 com auth.users (id compartilhado).
create table public.usuario (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.usuario_workshop (
  usuario_id uuid not null references public.usuario (id) on delete cascade,
  workshop_id uuid not null references public.workshop (id) on delete cascade,
  papel text not null check (papel in ('admin', 'gerente')),
  created_at timestamptz not null default now(),
  primary key (usuario_id, workshop_id)
);

create index usuario_workshop_workshop_id_idx on public.usuario_workshop (workshop_id);

create table public.cliente (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshop (id),
  tipo text not null check (tipo in ('PF', 'PJ')),
  nome text not null,
  documento text not null,
  telefone text not null,
  email text,
  cep text not null,
  logradouro text not null,
  numero text not null,
  complemento text,
  bairro text not null,
  cidade text not null,
  estado char(2) not null,
  origem text,
  notas text,
  consente_email boolean not null default false,
  consente_sms boolean not null default false,
  created_by uuid references public.usuario (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index cliente_workshop_id_idx on public.cliente (workshop_id);
create unique index cliente_workshop_documento_key
  on public.cliente (workshop_id, documento)
  where deleted_at is null;
create index cliente_workshop_nome_idx on public.cliente (workshop_id, nome)
  where deleted_at is null;

create table public.veiculo (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshop (id),
  cliente_id uuid not null references public.cliente (id),
  placa text not null,
  marca text,
  modelo text not null,
  versao text,
  ano integer,
  combustivel text,
  cor text,
  chassi text,
  renavam text,
  quilometragem integer,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index veiculo_workshop_cliente_idx on public.veiculo (workshop_id, cliente_id);
create unique index veiculo_workshop_placa_key
  on public.veiculo (workshop_id, placa)
  where deleted_at is null;
create unique index veiculo_workshop_chassi_key
  on public.veiculo (workshop_id, chassi)
  where deleted_at is null and chassi is not null;

-- Auditoria append-only: sem policy de update/delete para nenhum role de app.
create table public.auditoria (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshop (id),
  tabela text not null,
  registro_id uuid not null,
  usuario_id uuid references public.usuario (id),
  acao text not null check (acao in ('INSERT', 'UPDATE', 'DELETE')),
  dados_antigos jsonb,
  dados_novos jsonb,
  instante timestamptz not null default now()
);

create index auditoria_tabela_registro_idx on public.auditoria (tabela, registro_id);
create index auditoria_workshop_idx on public.auditoria (workshop_id);

-- =========================================================================
-- HELPER MULTI-TENANT
-- =========================================================================

-- Oficinas às quais o usuário autenticado pertence. security definer para
-- poder ler usuario_workshop mesmo com RLS ativo nela.
create or replace function app.current_workshop_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select workshop_id from public.usuario_workshop where usuario_id = auth.uid()
$$;

-- =========================================================================
-- TRIGGER updated_at
-- =========================================================================

create or replace function app.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger workshop_set_updated_at
  before update on public.workshop
  for each row execute function app.set_updated_at();

create trigger usuario_set_updated_at
  before update on public.usuario
  for each row execute function app.set_updated_at();

create trigger cliente_set_updated_at
  before update on public.cliente
  for each row execute function app.set_updated_at();

create trigger veiculo_set_updated_at
  before update on public.veiculo
  for each row execute function app.set_updated_at();

-- =========================================================================
-- PROVISIONAMENTO DE USUÁRIO (auth.users -> public.usuario)
-- =========================================================================

create or replace function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.usuario (id, nome, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nome', new.email), new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();

-- =========================================================================
-- TRIGGERS DE AUDITORIA (append-only, nenhuma mutação escapa sem log)
-- =========================================================================

create or replace function app.registrar_auditoria()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workshop_id uuid;
  v_registro_id uuid;
begin
  if tg_op = 'DELETE' then
    v_workshop_id := old.workshop_id;
    v_registro_id := old.id;
  else
    v_workshop_id := new.workshop_id;
    v_registro_id := new.id;
  end if;

  insert into public.auditoria (workshop_id, tabela, registro_id, usuario_id, acao, dados_antigos, dados_novos)
  values (
    v_workshop_id,
    tg_table_name,
    v_registro_id,
    auth.uid(),
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );

  return coalesce(new, old);
end;
$$;

create trigger cliente_auditoria
  after insert or update or delete on public.cliente
  for each row execute function app.registrar_auditoria();

create trigger veiculo_auditoria
  after insert or update or delete on public.veiculo
  for each row execute function app.registrar_auditoria();

-- =========================================================================
-- ROW LEVEL SECURITY
-- =========================================================================

alter table public.workshop enable row level security;
alter table public.workshop force row level security;
alter table public.usuario enable row level security;
alter table public.usuario force row level security;
alter table public.usuario_workshop enable row level security;
alter table public.usuario_workshop force row level security;
alter table public.cliente enable row level security;
alter table public.cliente force row level security;
alter table public.veiculo enable row level security;
alter table public.veiculo force row level security;
alter table public.auditoria enable row level security;
alter table public.auditoria force row level security;

-- workshop: só enxerga as oficinas às quais pertence.
create policy workshop_select on public.workshop
  for select to authenticated
  using (id in (select app.current_workshop_ids()));

-- usuario: só o próprio perfil (uso normal é via auth, não listagem de terceiros).
create policy usuario_select_self on public.usuario
  for select to authenticated
  using (id = auth.uid());

create policy usuario_update_self on public.usuario
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- usuario_workshop: só vê os próprios vínculos (não lista colegas nesta fase).
create policy usuario_workshop_select_self on public.usuario_workshop
  for select to authenticated
  using (usuario_id = auth.uid());

-- cliente: isolamento total por workshop_id. Sem policy de delete: hard
-- delete não é permitido para o role da aplicação (só soft delete via update).
create policy cliente_select on public.cliente
  for select to authenticated
  using (workshop_id in (select app.current_workshop_ids()));

create policy cliente_insert on public.cliente
  for insert to authenticated
  with check (workshop_id in (select app.current_workshop_ids()));

create policy cliente_update on public.cliente
  for update to authenticated
  using (workshop_id in (select app.current_workshop_ids()))
  with check (workshop_id in (select app.current_workshop_ids()));

-- veiculo: mesma política de cliente.
create policy veiculo_select on public.veiculo
  for select to authenticated
  using (workshop_id in (select app.current_workshop_ids()));

create policy veiculo_insert on public.veiculo
  for insert to authenticated
  with check (workshop_id in (select app.current_workshop_ids()));

create policy veiculo_update on public.veiculo
  for update to authenticated
  using (workshop_id in (select app.current_workshop_ids()))
  with check (workshop_id in (select app.current_workshop_ids()));

-- auditoria: só leitura do próprio tenant. Inserção só via trigger
-- (security definer), nunca diretamente pelo role da aplicação.
create policy auditoria_select on public.auditoria
  for select to authenticated
  using (workshop_id in (select app.current_workshop_ids()));

-- =========================================================================
-- BUSCA (tolerante a acento/caixa via unaccent)
-- =========================================================================

-- Não é security definer: roda com o papel de quem chama, então RLS de
-- cliente continua se aplicando normalmente dentro da função.
create or replace function public.buscar_clientes(p_termo text)
returns setof public.cliente
language sql
stable
as $$
  select *
  from public.cliente
  where deleted_at is null
    and (
      unaccent(nome) ilike unaccent('%' || p_termo || '%')
      or documento ilike '%' || p_termo || '%'
      or telefone ilike '%' || p_termo || '%'
    )
  order by nome
$$;

-- =========================================================================
-- STORAGE: fotos de veículo
-- Caminho do objeto: {workshop_id}/{veiculo_id}/{arquivo}
-- =========================================================================

insert into storage.buckets (id, name, public)
values ('veiculo-fotos', 'veiculo-fotos', false)
on conflict (id) do nothing;

create policy veiculo_fotos_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'veiculo-fotos'
    and (storage.foldername(name))[1]::uuid in (select app.current_workshop_ids())
  );

create policy veiculo_fotos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'veiculo-fotos'
    and (storage.foldername(name))[1]::uuid in (select app.current_workshop_ids())
  );
