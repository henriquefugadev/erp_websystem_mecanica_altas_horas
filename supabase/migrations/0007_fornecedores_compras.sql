-- Fase 4: módulo Fornecedores + Funcionários + fluxo de Compras (pedido de
-- compra direto → recebimento total/parcial → conta a pagar). Ver
-- docs/pesquisa/09. Sem cotação/RFQ (fora do MVP) e sem estoque (módulo
-- ainda não existe — itens do pedido são descrição livre, não uma peça de
-- catálogo; o recebimento não movimenta estoque nenhum).
--
-- 3-way match simplificado: cada recebimento (total ou parcial) gera sua
-- própria conta a pagar só do valor efetivamente recebido, via
-- criar_conta_financeira (mesma função do módulo financeiro/pátio). O
-- "documento fiscal" vira a própria conta a pagar — não há motor de nota
-- fiscal neste MVP (fora de escopo, ver CLAUDE.md).

-- =========================================================================
-- TABELAS: FORNECEDOR e FUNCIONÁRIO
-- Cadastro mínimo: só nome é obrigatório — reduz cliques da Michele.
-- =========================================================================

create table public.fornecedor (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshop (id),
  nome text not null,
  documento text,
  telefone text,
  email text,
  contato_nome text,
  condicoes_pagamento text,
  prazo_entrega_dias integer,
  observacoes text,
  ativo boolean not null default true,
  created_by uuid references public.usuario (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index fornecedor_workshop_idx on public.fornecedor (workshop_id)
  where deleted_at is null;
create unique index fornecedor_workshop_documento_key
  on public.fornecedor (workshop_id, documento)
  where deleted_at is null and documento is not null;
create index fornecedor_workshop_nome_idx on public.fornecedor (workshop_id, nome)
  where deleted_at is null;

create table public.funcionario (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshop (id),
  nome text not null,
  funcao text,
  telefone text,
  email text,
  ativo boolean not null default true,
  observacoes text,
  created_by uuid references public.usuario (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index funcionario_workshop_idx on public.funcionario (workshop_id)
  where deleted_at is null;
create index funcionario_workshop_nome_idx on public.funcionario (workshop_id, nome)
  where deleted_at is null;

-- =========================================================================
-- TABELAS: PEDIDO DE COMPRA E ITENS
-- =========================================================================

create table public.pedido_compra (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshop (id),
  numero integer not null,
  fornecedor_id uuid not null references public.fornecedor (id),
  categoria_id uuid not null references public.categoria_financeira (id),
  status text not null default 'aberto'
    check (status in ('aberto', 'parcial', 'recebido', 'cancelado')),
  data_emissao date not null default current_date,
  previsao_entrega date,
  observacoes text,
  ordem_servico_id uuid references public.ordem_servico (id),
  created_by uuid references public.usuario (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index pedido_compra_workshop_numero_key
  on public.pedido_compra (workshop_id, numero);
create index pedido_compra_workshop_status_idx
  on public.pedido_compra (workshop_id, status)
  where deleted_at is null;
create index pedido_compra_fornecedor_idx on public.pedido_compra (fornecedor_id);

create table public.pedido_compra_item (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshop (id),
  pedido_id uuid not null references public.pedido_compra (id) on delete cascade,
  descricao text not null,
  quantidade numeric(13, 3) not null check (quantidade > 0),
  preco_unitario numeric(13, 2) not null check (preco_unitario >= 0),
  quantidade_recebida numeric(13, 3) not null default 0 check (quantidade_recebida >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pedido_compra_item_recebida_nao_excede
    check (quantidade_recebida <= quantidade)
);

create index pedido_compra_item_pedido_idx on public.pedido_compra_item (pedido_id);

-- =========================================================================
-- TABELAS: RECEBIMENTO (imutável — histórico de conferência de mercadoria)
-- =========================================================================

create table public.recebimento_compra (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshop (id),
  pedido_id uuid not null references public.pedido_compra (id),
  data_recebimento date not null default current_date,
  observacoes text,
  conta_id uuid references public.conta_financeira (id),
  created_by uuid references public.usuario (id),
  created_at timestamptz not null default now()
);

create index recebimento_compra_pedido_idx on public.recebimento_compra (pedido_id);

create table public.recebimento_item (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshop (id),
  recebimento_id uuid not null references public.recebimento_compra (id) on delete cascade,
  pedido_item_id uuid not null references public.pedido_compra_item (id),
  quantidade_recebida numeric(13, 3) not null check (quantidade_recebida > 0),
  created_at timestamptz not null default now()
);

create index recebimento_item_recebimento_idx on public.recebimento_item (recebimento_id);
create index recebimento_item_pedido_item_idx on public.recebimento_item (pedido_item_id);

-- =========================================================================
-- ALTERAÇÕES EM TABELAS EXISTENTES
-- =========================================================================

-- conta a pagar gerada pelo recebimento aponta ao fornecedor de verdade;
-- fornecedor_nome (texto) continua existindo para exibição sem join.
alter table public.conta_financeira
  add column fornecedor_id uuid references public.fornecedor (id);

create index conta_financeira_fornecedor_idx on public.conta_financeira (fornecedor_id)
  where deleted_at is null;

-- Campo "tecnico" (texto livre) vira FK para funcionario agora que o
-- cadastro existe — sem dado em produção ainda, então troca direta em vez
-- de hack de retrocompatibilidade.
alter table public.ordem_servico add column funcionario_id uuid references public.funcionario (id);
alter table public.ordem_servico drop column tecnico;

-- =========================================================================
-- NUMERAÇÃO SEQUENCIAL DE PEDIDO DE COMPRA POR OFICINA (mesmo padrão de OS)
-- =========================================================================

create or replace function app.set_numero_pedido_compra()
returns trigger
language plpgsql
as $$
declare
  v_proximo integer;
begin
  perform pg_advisory_xact_lock(hashtext(new.workshop_id::text || ':pedido_compra'));

  select coalesce(max(numero), 0) + 1
  into v_proximo
  from public.pedido_compra
  where workshop_id = new.workshop_id;

  new.numero := v_proximo;
  return new;
end;
$$;

create trigger pedido_compra_set_numero
  before insert on public.pedido_compra
  for each row execute function app.set_numero_pedido_compra();

-- =========================================================================
-- TRIGGERS updated_at + AUDITORIA
-- =========================================================================

create trigger fornecedor_set_updated_at
  before update on public.fornecedor
  for each row execute function app.set_updated_at();

create trigger funcionario_set_updated_at
  before update on public.funcionario
  for each row execute function app.set_updated_at();

create trigger pedido_compra_set_updated_at
  before update on public.pedido_compra
  for each row execute function app.set_updated_at();

create trigger pedido_compra_item_set_updated_at
  before update on public.pedido_compra_item
  for each row execute function app.set_updated_at();

create trigger fornecedor_auditoria
  after insert or update or delete on public.fornecedor
  for each row execute function app.registrar_auditoria();

create trigger funcionario_auditoria
  after insert or update or delete on public.funcionario
  for each row execute function app.registrar_auditoria();

create trigger pedido_compra_auditoria
  after insert or update or delete on public.pedido_compra
  for each row execute function app.registrar_auditoria();

create trigger pedido_compra_item_auditoria
  after insert or update or delete on public.pedido_compra_item
  for each row execute function app.registrar_auditoria();

create trigger recebimento_compra_auditoria
  after insert or update or delete on public.recebimento_compra
  for each row execute function app.registrar_auditoria();

create trigger recebimento_item_auditoria
  after insert or update or delete on public.recebimento_item
  for each row execute function app.registrar_auditoria();

-- =========================================================================
-- ROW LEVEL SECURITY
-- =========================================================================

alter table public.fornecedor enable row level security;
alter table public.fornecedor force row level security;
alter table public.funcionario enable row level security;
alter table public.funcionario force row level security;
alter table public.pedido_compra enable row level security;
alter table public.pedido_compra force row level security;
alter table public.pedido_compra_item enable row level security;
alter table public.pedido_compra_item force row level security;
alter table public.recebimento_compra enable row level security;
alter table public.recebimento_compra force row level security;
alter table public.recebimento_item enable row level security;
alter table public.recebimento_item force row level security;

create policy fornecedor_select on public.fornecedor
  for select to authenticated
  using (workshop_id in (select app.current_workshop_ids()));
create policy fornecedor_insert on public.fornecedor
  for insert to authenticated
  with check (workshop_id in (select app.current_workshop_ids()));
create policy fornecedor_update on public.fornecedor
  for update to authenticated
  using (workshop_id in (select app.current_workshop_ids()))
  with check (workshop_id in (select app.current_workshop_ids()));

create policy funcionario_select on public.funcionario
  for select to authenticated
  using (workshop_id in (select app.current_workshop_ids()));
create policy funcionario_insert on public.funcionario
  for insert to authenticated
  with check (workshop_id in (select app.current_workshop_ids()));
create policy funcionario_update on public.funcionario
  for update to authenticated
  using (workshop_id in (select app.current_workshop_ids()))
  with check (workshop_id in (select app.current_workshop_ids()));

create policy pedido_compra_select on public.pedido_compra
  for select to authenticated
  using (workshop_id in (select app.current_workshop_ids()));
create policy pedido_compra_insert on public.pedido_compra
  for insert to authenticated
  with check (workshop_id in (select app.current_workshop_ids()));
create policy pedido_compra_update on public.pedido_compra
  for update to authenticated
  using (workshop_id in (select app.current_workshop_ids()))
  with check (workshop_id in (select app.current_workshop_ids()));

create policy pedido_compra_item_select on public.pedido_compra_item
  for select to authenticated
  using (workshop_id in (select app.current_workshop_ids()));
create policy pedido_compra_item_insert on public.pedido_compra_item
  for insert to authenticated
  with check (workshop_id in (select app.current_workshop_ids()));
create policy pedido_compra_item_update on public.pedido_compra_item
  for update to authenticated
  using (workshop_id in (select app.current_workshop_ids()))
  with check (workshop_id in (select app.current_workshop_ids()));

-- recebimento é imutável do ponto de vista da aplicação (Update: never no
-- TS), mas receber_pedido_compra roda como 'authenticated' (security
-- invoker) e precisa gravar o conta_id depois de criar a conta a pagar —
-- mesmo padrão de pagamento_financeira_update em 0002 (RPC interna x
-- imutabilidade de app são coisas diferentes; RLS não distingue quem
-- chama, só valida workshop_id).
create policy recebimento_compra_select on public.recebimento_compra
  for select to authenticated
  using (workshop_id in (select app.current_workshop_ids()));
create policy recebimento_compra_insert on public.recebimento_compra
  for insert to authenticated
  with check (workshop_id in (select app.current_workshop_ids()));
create policy recebimento_compra_update on public.recebimento_compra
  for update to authenticated
  using (workshop_id in (select app.current_workshop_ids()))
  with check (workshop_id in (select app.current_workshop_ids()));

create policy recebimento_item_select on public.recebimento_item
  for select to authenticated
  using (workshop_id in (select app.current_workshop_ids()));
create policy recebimento_item_insert on public.recebimento_item
  for insert to authenticated
  with check (workshop_id in (select app.current_workshop_ids()));

-- =========================================================================
-- criar_conta_financeira ganha p_fornecedor_id (novo parâmetro no fim muda a
-- assinatura — mesmo motivo do drop explícito em 0006: sem isso, a versão de
-- 12 parâmetros conviveria com esta e toda chamada viraria ambígua).
-- =========================================================================

drop function if exists public.criar_conta_financeira(
  uuid, text, text, uuid, numeric, date, uuid, text, text, uuid, jsonb, uuid
);

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
  p_parcelas jsonb,
  p_ordem_servico_id uuid default null,
  p_fornecedor_id uuid default null
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
    data_emissao, cliente_id, fornecedor_nome, observacoes, created_by,
    ordem_servico_id, fornecedor_id
  ) values (
    p_workshop_id, p_tipo, p_descricao, p_categoria_id, p_valor_total,
    p_data_emissao, p_cliente_id, p_fornecedor_nome, p_observacoes, p_created_by,
    p_ordem_servico_id, p_fornecedor_id
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

-- =========================================================================
-- RPC: cria o pedido de compra + seus itens atomicamente.
-- =========================================================================

create or replace function public.criar_pedido_compra(
  p_workshop_id uuid,
  p_fornecedor_id uuid,
  p_categoria_id uuid,
  p_data_emissao date,
  p_previsao_entrega date,
  p_observacoes text,
  p_ordem_servico_id uuid,
  p_created_by uuid,
  p_itens jsonb -- [{"descricao":"...", "quantidade":4, "preco_unitario":25.00}, ...]
)
returns uuid
language plpgsql
as $$
declare
  v_pedido_id uuid;
begin
  if p_itens is null or jsonb_array_length(p_itens) = 0 then
    raise exception 'Inclua ao menos um item no pedido.';
  end if;

  insert into public.pedido_compra (
    workshop_id, fornecedor_id, categoria_id, data_emissao,
    previsao_entrega, observacoes, ordem_servico_id, created_by
  ) values (
    p_workshop_id, p_fornecedor_id, p_categoria_id, p_data_emissao,
    p_previsao_entrega, p_observacoes, p_ordem_servico_id, p_created_by
  )
  returning id into v_pedido_id;

  insert into public.pedido_compra_item (workshop_id, pedido_id, descricao, quantidade, preco_unitario)
  select
    p_workshop_id,
    v_pedido_id,
    (i ->> 'descricao'),
    (i ->> 'quantidade')::numeric,
    (i ->> 'preco_unitario')::numeric
  from jsonb_array_elements(p_itens) as i;

  return v_pedido_id;
end;
$$;

-- =========================================================================
-- RPC: registra um recebimento (total ou parcial) e lança a conta a pagar
-- correspondente só do valor efetivamente recebido nesta conferência
-- (3-way match: pedido × recebimento × valor cobrado, sempre pelo recebido).
-- =========================================================================

create or replace function public.receber_pedido_compra(
  p_pedido_id uuid,
  p_itens jsonb, -- [{"pedido_item_id":"...", "quantidade":4}, ...]
  p_data_recebimento date,
  p_vencimento date,
  p_observacoes text,
  p_created_by uuid
)
returns uuid
language plpgsql
as $$
declare
  v_pedido record;
  v_fornecedor record;
  v_item record;
  v_entrada jsonb;
  v_saldo numeric(13, 3);
  v_qtd numeric(13, 3);
  v_valor_total numeric(13, 2) := 0;
  v_recebimento_id uuid;
  v_conta_id uuid;
  v_tudo_recebido boolean;
begin
  if p_itens is null or jsonb_array_length(p_itens) = 0 then
    raise exception 'Informe ao menos um item recebido.';
  end if;

  select * into v_pedido
  from public.pedido_compra
  where id = p_pedido_id
  for update;

  if not found then
    raise exception 'Pedido de compra não encontrado.';
  end if;

  if v_pedido.status in ('recebido', 'cancelado') then
    raise exception 'Pedido já está %, não é possível registrar recebimento.', v_pedido.status;
  end if;

  select * into v_fornecedor from public.fornecedor where id = v_pedido.fornecedor_id;

  insert into public.recebimento_compra (workshop_id, pedido_id, data_recebimento, observacoes, created_by)
  values (v_pedido.workshop_id, p_pedido_id, p_data_recebimento, p_observacoes, p_created_by)
  returning id into v_recebimento_id;

  for v_entrada in select * from jsonb_array_elements(p_itens)
  loop
    v_qtd := (v_entrada ->> 'quantidade')::numeric;

    select * into v_item
    from public.pedido_compra_item
    where id = (v_entrada ->> 'pedido_item_id')::uuid
      and pedido_id = p_pedido_id
    for update;

    if not found then
      raise exception 'Item do pedido não encontrado.';
    end if;

    if v_qtd <= 0 then
      raise exception 'Quantidade recebida de "%" deve ser maior que zero.', v_item.descricao;
    end if;

    v_saldo := v_item.quantidade - v_item.quantidade_recebida;
    if v_qtd > v_saldo then
      raise exception 'Quantidade recebida de "%" (%) excede o saldo pendente (%).',
        v_item.descricao, v_qtd, v_saldo;
    end if;

    insert into public.recebimento_item (workshop_id, recebimento_id, pedido_item_id, quantidade_recebida)
    values (v_pedido.workshop_id, v_recebimento_id, v_item.id, v_qtd);

    update public.pedido_compra_item
    set quantidade_recebida = quantidade_recebida + v_qtd
    where id = v_item.id;

    v_valor_total := v_valor_total + (v_qtd * v_item.preco_unitario);
  end loop;

  if v_valor_total > 0 then
    v_conta_id := public.criar_conta_financeira(
      v_pedido.workshop_id,
      'pagar',
      'Pedido de compra #' || v_pedido.numero || ' — ' || v_fornecedor.nome,
      v_pedido.categoria_id,
      v_valor_total,
      p_data_recebimento,
      null,
      v_fornecedor.nome,
      p_observacoes,
      p_created_by,
      jsonb_build_array(
        jsonb_build_object('numero', 1, 'valor', v_valor_total, 'vencimento', p_vencimento)
      ),
      v_pedido.ordem_servico_id,
      v_pedido.fornecedor_id
    );

    update public.recebimento_compra set conta_id = v_conta_id where id = v_recebimento_id;
  end if;

  select bool_and(quantidade_recebida >= quantidade) into v_tudo_recebido
  from public.pedido_compra_item
  where pedido_id = p_pedido_id;

  update public.pedido_compra
  set status = case when v_tudo_recebido then 'recebido' else 'parcial' end
  where id = p_pedido_id;

  return v_recebimento_id;
end;
$$;
