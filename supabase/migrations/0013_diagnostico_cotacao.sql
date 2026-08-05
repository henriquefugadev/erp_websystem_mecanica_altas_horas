-- Fase 2 (fluxo real): o diagnóstico do mecânico VIRA o rascunho do orçamento.
-- Hoje a mesma lista de peças é redigitada três vezes (diagnóstico → orçamento
-- do cliente → pedido de compra). Aqui a linha nasce uma vez, no diagnóstico,
-- e vive até o pedido: orcamento_item ganha os campos de cotação, o orçamento
-- passa a poder nascer a partir da OS (já vinculado a ela), e aprovar deixa de
-- criar OS duplicada quando o carro já está no pátio.

-- =========================================================================
-- (1) orcamento_item: campos de cotação + aprovado tri-estado
-- =========================================================================

alter table public.orcamento_item
  add column fornecedor_id uuid references public.fornecedor (id),
  add column custo_cotado numeric(13, 2) check (custo_cotado is null or custo_cotado >= 0),
  add column cotado_em timestamptz;

create index orcamento_item_fornecedor_idx
  on public.orcamento_item (fornecedor_id)
  where fornecedor_id is not null;

-- aprovado vira tri-estado: null = cliente ainda não respondeu, true = aprovou,
-- false = recusou. Os itens já existentes continuam aprovados (eram default
-- true), então não há backfill a fazer além de soltar o default/not null.
alter table public.orcamento_item
  alter column aprovado drop default,
  alter column aprovado drop not null;

-- Editar um rascunho troca a lista de itens inteira (atualizar_itens_orcamento
-- faz DELETE + INSERT). A 0011 só criou policies de select/insert/update para
-- orcamento_item — sem a de DELETE, o delete viraria no-op silencioso sob RLS.
create policy orcamento_item_delete on public.orcamento_item
  for delete to authenticated
  using (workshop_id in (select app.current_workshop_ids()));

-- =========================================================================
-- (2) orcamento: queixa opcional (herdada da OS) + índice por OS
-- =========================================================================

alter table public.orcamento
  alter column queixa drop not null;

create index orcamento_ordem_servico_idx
  on public.orcamento (ordem_servico_id)
  where ordem_servico_id is not null and deleted_at is null;

-- =========================================================================
-- (3) ordem_servico: motivo da parada (por que o carro está parado no pátio)
-- =========================================================================

alter table public.ordem_servico
  add column motivo_parada text
    check (
      motivo_parada is null
      or motivo_parada in (
        'aguardando_peca', 'aguardando_aprovacao', 'aguardando_cliente', 'outro'
      )
    );

-- =========================================================================
-- RPC: cria (ou reaproveita) o rascunho do orçamento a partir da OS.
-- Herda cliente/veículo/queixa da OS e já grava ordem_servico_id — é isso que
-- faz a mesma linha viver do diagnóstico até a compra. Sem preço aqui: o
-- mecânico não sabe o preço, ele entra na fase de cotação.
-- =========================================================================

create or replace function public.criar_orcamento_da_os(
  p_ordem_id uuid,
  p_itens jsonb, -- [{"tipo":"peca","descricao":"...","quantidade":1,"peca_id":"..."}]
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
    workshop_id, orcamento_id, peca_id, fornecedor_id, tipo, descricao,
    quantidade, preco_unitario, desconto, custo_cotado, aprovado
  )
  select
    v_ordem.workshop_id,
    v_orcamento_id,
    nullif(i ->> 'peca_id', '')::uuid,
    nullif(i ->> 'fornecedor_id', '')::uuid,
    coalesce(i ->> 'tipo', 'peca'),
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

-- =========================================================================
-- RPC: substitui os itens de um rascunho (edição do diagnóstico/orçamento).
-- Bloqueia se o orçamento já saiu do rascunho. O front reenvia os itens
-- existentes com seus preços/cotações preservados, então o replace não perde
-- trabalho já feito.
-- =========================================================================

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
    workshop_id, orcamento_id, peca_id, fornecedor_id, tipo, descricao,
    quantidade, preco_unitario, desconto, custo_cotado, aprovado
  )
  select
    v_orcamento.workshop_id,
    p_orcamento_id,
    nullif(i ->> 'peca_id', '')::uuid,
    nullif(i ->> 'fornecedor_id', '')::uuid,
    coalesce(i ->> 'tipo', 'peca'),
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

-- Soma quantidade × preço − desconto de todos os itens (mesma regra de
-- criar_orcamento, 0011). Isolada aqui porque três RPCs recalculam o total.
create or replace function public.recalcular_total_orcamento(p_orcamento_id uuid)
returns void
language sql
as $$
  update public.orcamento
  set valor_total = (
    select coalesce(sum(quantidade * preco_unitario - desconto), 0)
    from public.orcamento_item
    where orcamento_id = p_orcamento_id
  )
  where id = p_orcamento_id;
$$;

-- =========================================================================
-- ALTERA aprovar_orcamento: quando o orçamento já veio de uma OS
-- (ordem_servico_id preenchido), NÃO cria outra OS — só atualiza a descrição
-- da existente. Mantém o comportamento antigo (criar OS) para orçamentos
-- avulsos, sem vínculo com o pátio.
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

  if v_orcamento.ordem_servico_id is not null then
    -- Carro já está no pátio: reutiliza a OS, só atualiza a descrição.
    v_ordem_id := v_orcamento.ordem_servico_id;
    update public.ordem_servico
    set descricao = 'Itens aprovados do orçamento #' || v_orcamento.numero || e':\n'
      || coalesce(v_descricao_os, '')
    where id = v_ordem_id;

    update public.orcamento
    set status = v_novo_status, respondido_em = now()
    where id = p_orcamento_id;
  else
    -- Orçamento avulso: cria a OS (comportamento original).
    insert into public.ordem_servico (
      workshop_id, cliente_id, veiculo_id, queixa, descricao, orcamento_id, created_by
    ) values (
      v_orcamento.workshop_id, v_orcamento.cliente_id, v_orcamento.veiculo_id,
      v_orcamento.queixa,
      'Itens do orçamento #' || v_orcamento.numero || e':\n' || coalesce(v_descricao_os, ''),
      p_orcamento_id, p_created_by
    )
    returning id into v_ordem_id;

    update public.orcamento
    set status = v_novo_status, respondido_em = now(), ordem_servico_id = v_ordem_id
    where id = p_orcamento_id;
  end if;

  return v_ordem_id;
end;
$$;
