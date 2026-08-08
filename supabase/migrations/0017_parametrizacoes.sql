-- Fase (Parametrizações + ajustes de fluxo):
-- (1) Tipos de item de orçamento configuráveis pela oficina (antes fixos em
--     'peca'/'servico'). A coluna orcamento_item.tipo continua guardando a
--     NATUREZA ('peca'/'servico') — é ela que dirige a categorização na
--     conclusão e o "falta peça" da compra. O rótulo escolhido pelo usuário
--     vive em orcamento_item.tipo_nome e na tabela tipo_item_orcamento.
-- (2) Config da oficina: liga/desliga do markup e itens ocultos da sidebar.
-- (3) Novo status de pátio 'aguardando_confirmacao' (Esperando Confirmação do
--     Cliente) entre 'aguardando' e 'em_execucao'.

-- =========================================================================
-- (1a) TABELA: tipos de item do orçamento (por oficina)
-- =========================================================================

create table public.tipo_item_orcamento (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshop (id),
  nome text not null,
  -- Natureza dita o comportamento financeiro/compra; o rótulo (nome) é livre.
  natureza text not null check (natureza in ('peca', 'servico')),
  ativo boolean not null default true,
  ordem smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Nome único por oficina (case-insensitive) — não deixa criar "Peça" duas vezes.
create unique index tipo_item_orcamento_workshop_nome_key
  on public.tipo_item_orcamento (workshop_id, lower(nome));
create index tipo_item_orcamento_workshop_idx
  on public.tipo_item_orcamento (workshop_id);

create trigger tipo_item_orcamento_set_updated_at
  before update on public.tipo_item_orcamento
  for each row execute function app.set_updated_at();

create trigger tipo_item_orcamento_auditoria
  after insert or update or delete on public.tipo_item_orcamento
  for each row execute function app.registrar_auditoria();

-- RLS: todos da oficina leem (o dialog do pátio precisa listar). Escrita é
-- restrita ao admin (mesma regra de workshop_update em 0010) — parametrização
-- é de configuração.
alter table public.tipo_item_orcamento enable row level security;
alter table public.tipo_item_orcamento force row level security;

create policy tipo_item_orcamento_select on public.tipo_item_orcamento
  for select to authenticated
  using (workshop_id in (select app.current_workshop_ids()));

create policy tipo_item_orcamento_insert on public.tipo_item_orcamento
  for insert to authenticated
  with check (
    workshop_id in (
      select workshop_id from public.usuario_workshop
      where usuario_id = auth.uid() and papel = 'admin'
    )
  );

create policy tipo_item_orcamento_update on public.tipo_item_orcamento
  for update to authenticated
  using (
    workshop_id in (
      select workshop_id from public.usuario_workshop
      where usuario_id = auth.uid() and papel = 'admin'
    )
  )
  with check (
    workshop_id in (
      select workshop_id from public.usuario_workshop
      where usuario_id = auth.uid() and papel = 'admin'
    )
  );

create policy tipo_item_orcamento_delete on public.tipo_item_orcamento
  for delete to authenticated
  using (
    workshop_id in (
      select workshop_id from public.usuario_workshop
      where usuario_id = auth.uid() and papel = 'admin'
    )
  );

-- Seed: Peça e Serviço para cada oficina existente (os dois tipos de hoje).
insert into public.tipo_item_orcamento (workshop_id, nome, natureza, ordem)
select w.id, v.nome, v.natureza, v.ordem
from public.workshop w
cross join (values ('Peça', 'peca', 0), ('Serviço', 'servico', 1)) as v(nome, natureza, ordem);

-- =========================================================================
-- (1b) RÓTULO DO TIPO POR ITEM
-- =========================================================================

alter table public.orcamento_item add column tipo_nome text;

-- =========================================================================
-- (1c) RPCs de item passam a gravar tipo_nome (natureza segue em 'tipo').
-- Reescrita fiel das últimas definições (0011/0013) + a coluna tipo_nome.
-- =========================================================================

create or replace function public.criar_orcamento_da_os(
  p_ordem_id uuid,
  p_itens jsonb, -- [{"tipo":"peca","tipo_nome":"Peça","descricao":"...","quantidade":1,"peca_id":"..."}]
  p_created_by uuid
)
returns uuid
language plpgsql
as $$
declare
  v_ordem record;
  v_workshop record;
  v_orcamento_id uuid;
begin
  if p_itens is null or jsonb_array_length(p_itens) = 0 then
    raise exception 'Diagnóstico precisa de ao menos um item.';
  end if;

  select * into v_ordem
  from public.ordem_servico
  where id = p_ordem_id and deleted_at is null
  for update;

  if not found then
    raise exception 'Ordem de serviço não encontrada.';
  end if;

  -- Não duplica orçamento: se a OS já tem um rascunho, os itens entram nele.
  select id into v_orcamento_id
  from public.orcamento
  where ordem_servico_id = p_ordem_id
    and status = 'rascunho'
    and deleted_at is null
  order by created_at
  limit 1;

  if v_orcamento_id is null then
    select validade_orcamento_dias, condicoes_pagamento_padrao
    into v_workshop
    from public.workshop
    where id = v_ordem.workshop_id;

    insert into public.orcamento (
      workshop_id, cliente_id, veiculo_id, queixa, condicoes_pagamento,
      status, valor_total, validade, ordem_servico_id, created_by
    ) values (
      v_ordem.workshop_id, v_ordem.cliente_id, v_ordem.veiculo_id,
      v_ordem.queixa, v_workshop.condicoes_pagamento_padrao,
      'rascunho', 0,
      current_date + coalesce(v_workshop.validade_orcamento_dias, 10),
      p_ordem_id, p_created_by
    )
    returning id into v_orcamento_id;

    -- Elo reverso: a OS aponta para o orçamento "corrente".
    update public.ordem_servico
    set orcamento_id = v_orcamento_id
    where id = p_ordem_id;
  end if;

  insert into public.orcamento_item (
    workshop_id, orcamento_id, peca_id, fornecedor_id, tipo, tipo_nome, descricao,
    quantidade, preco_unitario, desconto, custo_cotado, aprovado
  )
  select
    v_ordem.workshop_id,
    v_orcamento_id,
    nullif(i ->> 'peca_id', '')::uuid,
    nullif(i ->> 'fornecedor_id', '')::uuid,
    coalesce(i ->> 'tipo', 'peca'),
    nullif(i ->> 'tipo_nome', ''),
    i ->> 'descricao',
    coalesce((i ->> 'quantidade')::numeric, 1),
    coalesce((i ->> 'preco_unitario')::numeric, 0),
    coalesce((i ->> 'desconto')::numeric, 0),
    nullif(i ->> 'custo_cotado', '')::numeric,
    null
  from jsonb_array_elements(p_itens) as i;

  perform public.recalcular_total_orcamento(v_orcamento_id);

  return v_orcamento_id;
end;
$$;

create or replace function public.atualizar_itens_orcamento(
  p_orcamento_id uuid,
  p_itens jsonb
)
returns void
language plpgsql
as $$
declare
  v_orcamento record;
begin
  if p_itens is null or jsonb_array_length(p_itens) = 0 then
    raise exception 'Informe ao menos um item.';
  end if;

  select * into v_orcamento
  from public.orcamento
  where id = p_orcamento_id and deleted_at is null
  for update;

  if not found then
    raise exception 'Orçamento não encontrado.';
  end if;

  if v_orcamento.status <> 'rascunho' then
    raise exception 'Só dá para editar os itens de um orçamento em rascunho.';
  end if;

  delete from public.orcamento_item where orcamento_id = p_orcamento_id;

  insert into public.orcamento_item (
    workshop_id, orcamento_id, peca_id, fornecedor_id, tipo, tipo_nome, descricao,
    quantidade, preco_unitario, desconto, custo_cotado, aprovado
  )
  select
    v_orcamento.workshop_id,
    p_orcamento_id,
    nullif(i ->> 'peca_id', '')::uuid,
    nullif(i ->> 'fornecedor_id', '')::uuid,
    coalesce(i ->> 'tipo', 'peca'),
    nullif(i ->> 'tipo_nome', ''),
    i ->> 'descricao',
    coalesce((i ->> 'quantidade')::numeric, 1),
    coalesce((i ->> 'preco_unitario')::numeric, 0),
    coalesce((i ->> 'desconto')::numeric, 0),
    nullif(i ->> 'custo_cotado', '')::numeric,
    null
  from jsonb_array_elements(p_itens) as i;

  perform public.recalcular_total_orcamento(p_orcamento_id);
end;
$$;

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
    workshop_id, orcamento_id, peca_id, tipo, tipo_nome, descricao, quantidade, preco_unitario, desconto
  )
  select
    p_workshop_id,
    v_orcamento_id,
    nullif(i ->> 'peca_id', '')::uuid,
    i ->> 'tipo',
    nullif(i ->> 'tipo_nome', ''),
    i ->> 'descricao',
    (i ->> 'quantidade')::numeric,
    (i ->> 'preco_unitario')::numeric,
    coalesce((i ->> 'desconto')::numeric, 0)
  from jsonb_array_elements(p_itens) as i;

  return v_orcamento_id;
end;
$$;

-- =========================================================================
-- (2) CONFIG DA OFICINA: markup liga/desliga + itens ocultos da sidebar
-- =========================================================================

alter table public.workshop
  add column markup_habilitado boolean not null default false,
  add column nav_ocultos text[] not null default '{}'::text[];

-- Estado inicial pedido: Orçamentos, Estoque, Cotações e Pedidos escondidos
-- (a oficina não usa esses módulos por enquanto; dá pra religar nas Configs).
update public.workshop
set nav_ocultos = array['/orcamentos', '/estoque', '/cotacoes', '/compras'];

-- =========================================================================
-- (3) NOVO STATUS 'aguardando_confirmacao'
-- Mesmo padrão de 0006: acha o CHECK de status pelo catálogo e recria.
-- =========================================================================

do $$
declare
  v_nome text;
begin
  select c.conname into v_nome
  from pg_constraint c
  join pg_attribute a
    on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
  where c.conrelid = 'public.ordem_servico'::regclass
    and c.contype = 'c'
    and array_length(c.conkey, 1) = 1
    and a.attname = 'status';

  if v_nome is not null then
    execute format('alter table public.ordem_servico drop constraint %I', v_nome);
  end if;
end $$;

alter table public.ordem_servico
  add constraint ordem_servico_status_check
  check (status in ('aguardando', 'aguardando_confirmacao', 'em_execucao', 'parado', 'concluido', 'cancelada'));

-- O carro que veio da execução para "esperando confirmação" continua ocupando
-- a baia — o novo status entra na lista de status que podem ter galpão.
alter table public.ordem_servico drop constraint ordem_servico_galpao_so_execucao;
alter table public.ordem_servico add constraint ordem_servico_galpao_so_execucao
  check (galpao is null or status in ('em_execucao', 'parado', 'concluido', 'aguardando_confirmacao'));
