-- Shim mínimo do ambiente Supabase para rodar as migrações reais contra o
-- Postgres do pglite nos testes. NÃO faz parte de supabase/migrations — só
-- reproduz o que o próprio Supabase já provê em produção (schemas auth e
-- storage, roles, auth.uid()), para que 0001_init.sql rode sem alterações.

create role authenticated;
create role anon;

-- 0001_init.sql também faz `create schema if not exists app` — criá-lo já
-- aqui só permite configurar os default privileges antes das tabelas
-- existirem; não duplica nada.
create schema app;
create schema auth;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

-- Implementação idêntica à do Supabase: lê o "sub" do JWT da sessão atual,
-- setado via `set local request.jwt.claim.sub = '<uuid>'` nos testes.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select
    coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    )::uuid
$$;

create schema storage;

create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false
);

create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid,
  created_at timestamptz not null default now()
);

create or replace function storage.foldername(name text)
returns text[]
language sql
immutable
as $$
  select (string_to_array(name, '/'))[1 : array_length(string_to_array(name, '/'), 1) - 1]
$$;

grant usage on schema public, auth, storage, app to authenticated, anon;
grant select, insert on storage.objects to authenticated;
grant select on storage.buckets to authenticated;

-- public.* ainda não existe (é criado por 0001_init.sql, que roda depois
-- deste shim) — usa default privileges para que as tabelas futuras já
-- nasçam com os grants amplos que o Supabase concede por padrão ao role
-- authenticated. O isolamento real vem das RLS policies (e da ausência
-- delas), não da falta de GRANT — replica o comportamento de produção.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema app
  grant execute on functions to authenticated;
