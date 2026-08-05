-- Fase 6 (fluxo real): da aprovação para a compra sem redigitar.
-- Hoje a Michele reescreve em /compras o que já está no orçamento aprovado.
-- Aqui o orçamento gera os pedidos de compra direto — um por fornecedor, com
-- os custos cotados — e o recebimento destrava a OS que estava esperando peça.

-- =========================================================================
-- (1) Elo item de pedido → item de orçamento (de onde a compra veio)
-- =========================================================================

alter table public.pedido_compra_item
  add column orcamento_item_id uuid references public.orcamento_item (id);

create index pedido_compra_item_orcamento_item_idx
  on public.pedido_compra_item (orcamento_item_id)
  where orcamento_item_id is not null;

-- =========================================================================
-- criar_pedido_compra: passa a gravar orcamento_item_id quando vier no item
-- (o formulário manual não manda — fica nulo, sem quebrar). Só o corpo muda;
-- a assinatura é a mesma, então CREATE OR REPLACE basta.
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
  p_itens jsonb
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

  insert into public.pedido_compra_item (
    workshop_id, pedido_id, descricao, quantidade, preco_unitario, orcamento_item_id
  )
  select
    p_workshop_id,
    v_pedido_id,
    (i ->> 'descricao'),
    (i ->> 'quantidade')::numeric,
    (i ->> 'preco_unitario')::numeric,
    nullif(i ->> 'orcamento_item_id', '')::uuid
  from jsonb_array_elements(p_itens) as i;

  return v_pedido_id;
end;
$$;

-- =========================================================================
-- RPC: gera os pedidos de compra a partir dos itens APROVADOS do orçamento.
-- Agrupa por fornecedor (um pedido por fornecedor), com preço = custo cotado,
-- herdando a OS do orçamento. Itens sem fornecedor ou sem custo ficam de fora
-- (a aplicação avisa). Retorna os ids dos pedidos criados.
-- =========================================================================

create or replace function public.gerar_pedidos_do_orcamento(
  p_orcamento_id uuid,
  p_categoria_id uuid,
  p_created_by uuid
)
returns uuid[]
language plpgsql
as $$
declare
  v_orcamento record;
  v_fornecedor_id uuid;
  v_itens jsonb;
  v_pedido_id uuid;
  v_pedidos uuid[] := '{}';
begin
  select * into v_orcamento from public.orcamento where id = p_orcamento_id;
  if not found then
    raise exception 'Orçamento não encontrado.';
  end if;

  for v_fornecedor_id in
    select distinct fornecedor_id
    from public.orcamento_item
    where orcamento_id = p_orcamento_id
      and tipo = 'peca'
      and aprovado = true
      and fornecedor_id is not null
      and custo_cotado is not null
  loop
    select jsonb_agg(
      jsonb_build_object(
        'descricao', descricao,
        'quantidade', quantidade,
        'preco_unitario', custo_cotado,
        'orcamento_item_id', id
      )
    )
    into v_itens
    from public.orcamento_item
    where orcamento_id = p_orcamento_id
      and tipo = 'peca'
      and aprovado = true
      and fornecedor_id = v_fornecedor_id
      and custo_cotado is not null;

    v_pedido_id := public.criar_pedido_compra(
      v_orcamento.workshop_id,
      v_fornecedor_id,
      p_categoria_id,
      current_date,
      null,
      'Gerado do orçamento #' || v_orcamento.numero,
      v_orcamento.ordem_servico_id,
      p_created_by,
      v_itens
    );

    v_pedidos := array_append(v_pedidos, v_pedido_id);
  end loop;

  return v_pedidos;
end;
$$;

-- =========================================================================
-- receber_pedido_compra: mesma lógica de antes, mas ao concluir o
-- recebimento (pedido 'recebido'), se a OS vinculada estava parada esperando
-- peça, ela volta para "aguardando" (liberada para os mecânicos).
-- =========================================================================

create or replace function public.receber_pedido_compra(
  p_pedido_id uuid,
  p_itens jsonb,
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

  -- Peça chegou: se a OS vinculada estava parada esperando peça, libera.
  if v_tudo_recebido and v_pedido.ordem_servico_id is not null then
    update public.ordem_servico
    set status = 'aguardando', motivo_parada = null, data_pausa = null, galpao = null
    where id = v_pedido.ordem_servico_id
      and status = 'parado'
      and motivo_parada = 'aguardando_peca';
  end if;

  return v_recebimento_id;
end;
$$;
