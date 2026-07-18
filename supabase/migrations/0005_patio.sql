-- Fase 3: módulo Pátio — Ordem de Serviço enxuta + quadro kanban (3 baias de
-- status: aguardando/em_execucao/concluido). Sem itens/peças/valores na OS
-- neste MVP (ver docs/pesquisa/02, 06) — isso fica para o módulo de OS
-- completo, quando estoque/fornecedores entrarem.

-- =========================================================================
-- TABELA
-- =========================================================================

create table public.ordem_servico (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshop (id),
  numero integer not null,
  cliente_id uuid not null references public.cliente (id),
  veiculo_id uuid not null references public.veiculo (id),
  queixa text not null,
  descricao text,
  tecnico text,
  status text not null default 'aguardando'
    check (status in ('aguardando', 'em_execucao', 'concluido', 'cancelada')),
  galpao smallint check (galpao between 1 and 3),
  conta_id uuid references public.conta_financeira (id),
  data_abertura timestamptz not null default now(),
  data_inicio timestamptz,
  data_conclusao timestamptz,
  created_by uuid references public.usuario (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint ordem_servico_galpao_so_execucao
    check (galpao is null or status in ('em_execucao', 'concluido'))
);

create index ordem_servico_workshop_status_idx
  on public.ordem_servico (workshop_id, status)
  where deleted_at is null;
create index ordem_servico_veiculo_idx on public.ordem_servico (veiculo_id);
create unique index ordem_servico_workshop_numero_key
  on public.ordem_servico (workshop_id, numero);

-- =========================================================================
-- NUMERAÇÃO SEQUENCIAL POR OFICINA
-- Lock consultivo por workshop_id evita numero duplicado sob concorrência
-- sem depender de uma sequence global (que resetaria por oficina de forma
-- errada em ambiente multi-tenant).
-- =========================================================================

create or replace function app.set_numero_os()
returns trigger
language plpgsql
as $$
declare
  v_proximo integer;
begin
  perform pg_advisory_xact_lock(hashtext(new.workshop_id::text));

  select coalesce(max(numero), 0) + 1
  into v_proximo
  from public.ordem_servico
  where workshop_id = new.workshop_id;

  new.numero := v_proximo;
  return new;
end;
$$;

create trigger ordem_servico_set_numero
  before insert on public.ordem_servico
  for each row execute function app.set_numero_os();

-- =========================================================================
-- TRIGGERS updated_at + AUDITORIA (mesmo padrão de cliente/veiculo/financeiro)
-- =========================================================================

create trigger ordem_servico_set_updated_at
  before update on public.ordem_servico
  for each row execute function app.set_updated_at();

create trigger ordem_servico_auditoria
  after insert or update or delete on public.ordem_servico
  for each row execute function app.registrar_auditoria();

-- =========================================================================
-- ROW LEVEL SECURITY
-- =========================================================================

alter table public.ordem_servico enable row level security;
alter table public.ordem_servico force row level security;

create policy ordem_servico_select on public.ordem_servico
  for select to authenticated
  using (workshop_id in (select app.current_workshop_ids()));

create policy ordem_servico_insert on public.ordem_servico
  for insert to authenticated
  with check (workshop_id in (select app.current_workshop_ids()));

create policy ordem_servico_update on public.ordem_servico
  for update to authenticated
  using (workshop_id in (select app.current_workshop_ids()))
  with check (workshop_id in (select app.current_workshop_ids()));

-- =========================================================================
-- REALTIME — quadro atualiza sozinho entre dispositivos, sem refresh manual.
-- Guardado por existência da publicação: no ambiente de teste (pglite) não
-- há replicação lógica configurada, então o bloco vira no-op.
-- =========================================================================

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.ordem_servico;
  end if;
end $$;

-- =========================================================================
-- RPC: conclui a OS e, se houver valor a cobrar, já gera a conta a receber
-- correspondente no Financeiro (ponte entre os dois módulos) — Michele não
-- precisa lançar a mesma cobrança duas vezes.
-- =========================================================================

create or replace function public.concluir_ordem_servico(
  p_ordem_id uuid,
  p_valor numeric,
  p_vencimento date,
  p_categoria_id uuid,
  p_created_by uuid
)
returns uuid
language plpgsql
as $$
declare
  v_ordem record;
  v_conta_id uuid;
begin
  select * into v_ordem
  from public.ordem_servico
  where id = p_ordem_id
  for update;

  if not found then
    raise exception 'Ordem de serviço não encontrada.';
  end if;

  if v_ordem.status in ('concluido', 'cancelada') then
    raise exception 'OS já está %, não é possível concluir.', v_ordem.status;
  end if;

  if p_valor is not null and p_valor > 0 then
    v_conta_id := public.criar_conta_financeira(
      v_ordem.workshop_id,
      'receber',
      'OS #' || v_ordem.numero || ' — ' || v_ordem.queixa,
      p_categoria_id,
      p_valor,
      current_date,
      v_ordem.cliente_id,
      null,
      null,
      p_created_by,
      jsonb_build_array(
        jsonb_build_object('numero', 1, 'valor', p_valor, 'vencimento', p_vencimento)
      )
    );
  end if;

  update public.ordem_servico
  set status = 'concluido',
      data_conclusao = now(),
      conta_id = v_conta_id
  where id = p_ordem_id;

  return v_conta_id;
end;
$$;
