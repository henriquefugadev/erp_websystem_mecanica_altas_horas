-- Fase 3 (fluxo real): cotação de peças com fornecedor, em lote.
-- Hoje a Michele recebe os preços do fornecedor pelo WhatsApp e calcula o
-- preço de venda de cabeça. Aqui a oficina passa a ter um markup padrão
-- (margem %) e o valor da hora de mão de obra; ao lançar o custo cotado de uma
-- peça, o preço de venda sai pronto (custo × markup).

-- =========================================================================
-- (1) workshop: markup padrão de peça + valor da hora de mão de obra
-- =========================================================================

alter table public.workshop
  add column markup_peca_percentual numeric(5, 2) not null default 30
    check (markup_peca_percentual >= 0),
  add column valor_hora_mao_obra numeric(13, 2) not null default 0
    check (valor_hora_mao_obra >= 0);

-- =========================================================================
-- RPC: grava as cotações de uma leva de itens de uma vez e recalcula o total
-- dos orçamentos afetados. O preço de venda vem calculado da aplicação
-- (aplicarMarkup, com o markup lido do servidor) — a RPC é só escritora, para
-- não duplicar a regra de arredondamento em SQL e em TS.
-- =========================================================================

create or replace function public.salvar_cotacoes(p_itens jsonb)
returns void
language plpgsql
as $$
declare
  v_item jsonb;
  v_id uuid;
  v_custo numeric;
begin
  if p_itens is null or jsonb_array_length(p_itens) = 0 then
    return;
  end if;

  for v_item in select value from jsonb_array_elements(p_itens) as t(value)
  loop
    v_id := (v_item ->> 'id')::uuid;
    v_custo := nullif(v_item ->> 'custo_cotado', '')::numeric;

    update public.orcamento_item
    set
      fornecedor_id = nullif(v_item ->> 'fornecedor_id', '')::uuid,
      custo_cotado = v_custo,
      cotado_em = case when v_custo is not null then now() else cotado_em end,
      -- só mexe no preço quando há custo novo; o preço fica editável depois.
      preco_unitario = case
        when v_custo is not null then coalesce((v_item ->> 'preco_unitario')::numeric, preco_unitario)
        else preco_unitario
      end
    where id = v_id;
  end loop;

  -- Recalcula o total de cada orçamento tocado (um item pode ter mudado o preço).
  perform public.recalcular_total_orcamento(orc_id)
  from (
    select distinct oi.orcamento_id as orc_id
    from public.orcamento_item oi
    where oi.id in (
      select (e ->> 'id')::uuid from jsonb_array_elements(p_itens) as e
    )
  ) afetados;
end;
$$;
