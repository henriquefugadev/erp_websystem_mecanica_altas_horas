-- Fase 2 (Configurações): dados fiscais/endereço/logo da oficina + padrões de
-- orçamento (condições de pagamento, validade em dias). Pré-requisito do PDF
-- de orçamento (docs/pesquisa/05), que precisa desses dados no cabeçalho.
-- Tudo nullable (exceto o default de validade) — mesma filosofia de
-- 0009_reduz_obrigatorios_cliente.sql: Jadson preenche aos poucos.

alter table public.workshop
  add column razao_social text,
  add column cnpj text,
  add column telefone text,
  add column email text,
  add column cep text,
  add column logradouro text,
  add column numero text,
  add column complemento text,
  add column bairro text,
  add column cidade text,
  add column estado char(2),
  add column condicoes_pagamento_padrao text,
  add column validade_orcamento_dias integer not null default 10,
  add column logo_path text;

-- =========================================================================
-- AUDITORIA — workshop não tem coluna workshop_id (a linha É o tenant), então
-- não dá pra reaproveitar app.registrar_auditoria() como está: precisa de uma
-- variante que usa o próprio id como workshop_id e registro_id.
-- =========================================================================

create or replace function app.registrar_auditoria_workshop()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  v_id := coalesce(new.id, old.id);

  insert into public.auditoria (workshop_id, tabela, registro_id, usuario_id, acao, dados_antigos, dados_novos)
  values (
    v_id,
    tg_table_name,
    v_id,
    auth.uid(),
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );

  return coalesce(new, old);
end;
$$;

create trigger workshop_auditoria
  after insert or update or delete on public.workshop
  for each row execute function app.registrar_auditoria_workshop();

-- =========================================================================
-- RLS: update restrito a admin (só existia select até aqui)
-- =========================================================================

create policy workshop_update on public.workshop
  for update to authenticated
  using (
    id in (
      select workshop_id from public.usuario_workshop
      where usuario_id = auth.uid() and papel = 'admin'
    )
  )
  with check (
    id in (
      select workshop_id from public.usuario_workshop
      where usuario_id = auth.uid() and papel = 'admin'
    )
  );

-- =========================================================================
-- STORAGE: logo da oficina (1 arquivo por workshop, sobrescrito via upsert)
-- Caminho do objeto: {workshop_id}/logo.{ext}
-- =========================================================================

insert into storage.buckets (id, name, public)
values ('workshop-logo', 'workshop-logo', false)
on conflict (id) do nothing;

create policy workshop_logo_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'workshop-logo'
    and (storage.foldername(name))[1]::uuid in (select app.current_workshop_ids())
  );

create policy workshop_logo_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'workshop-logo'
    and (storage.foldername(name))[1]::uuid in (
      select workshop_id from public.usuario_workshop
      where usuario_id = auth.uid() and papel = 'admin'
    )
  );

create policy workshop_logo_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'workshop-logo'
    and (storage.foldername(name))[1]::uuid in (
      select workshop_id from public.usuario_workshop
      where usuario_id = auth.uid() and papel = 'admin'
    )
  )
  with check (
    bucket_id = 'workshop-logo'
    and (storage.foldername(name))[1]::uuid in (
      select workshop_id from public.usuario_workshop
      where usuario_id = auth.uid() and papel = 'admin'
    )
  );

create policy workshop_logo_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'workshop-logo'
    and (storage.foldername(name))[1]::uuid in (
      select workshop_id from public.usuario_workshop
      where usuario_id = auth.uid() and papel = 'admin'
    )
  );
