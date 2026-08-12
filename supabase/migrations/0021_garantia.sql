-- Garantia do serviço: toda OS concluída passa a carregar uma garantia (padrão
-- 3 meses). Quando o cliente volta reclamando, a oficina confere na hora se
-- ainda está na validade — na OS e no histórico do cliente ("meus clientes").
-- A garantia é do SERVIÇO (a OS), não do cliente/veículo: cada serviço tem a
-- sua, e aparece no perfil do cliente junto ao veículo em que foi feito.

-- =========================================================================
-- (1) COLUNAS
-- garantia_meses: quantos meses de garantia (padrão 3, configurável no futuro).
-- garantia_ate:   data-limite, carimbada na conclusão (= dia + garantia_meses).
-- =========================================================================

alter table public.ordem_servico
  add column garantia_meses smallint not null default 3
    check (garantia_meses >= 0),
  add column garantia_ate date;

-- =========================================================================
-- (2) CONCLUSÃO carimba a garantia
-- Igual à 0020 (descrição da conta com veículo), só acrescenta o
-- garantia_ate = data da conclusão + garantia_meses no UPDATE final. O lado
-- direito do SET enxerga o valor atual de garantia_meses (o default 3).
-- =========================================================================

create or replace function public.concluir_ordem_servico(
  p_ordem_id uuid,
  p_itens jsonb, -- [{"categoria_id":"...", "valor":100.00}, ...] ou null/[]
  p_vencimento date,
  p_created_by uuid
)
returns uuid[]
language plpgsql
as $$
declare
  v_ordem record;
  v_veiculo_desc text;
  v_conta_ids uuid[] := '{}';
  v_item jsonb;
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

  -- Modelo + cor do veículo para compor a descrição da conta.
  select nullif(trim(
    coalesce(v.marca || ' ', '') || v.modelo || coalesce(' ' || v.cor, '')
  ), '')
  into v_veiculo_desc
  from public.veiculo v
  where v.id = v_ordem.veiculo_id;

  if p_itens is not null then
    for v_item in select * from jsonb_array_elements(p_itens)
    loop
      select public.criar_conta_financeira(
        v_ordem.workshop_id,
        'receber',
        'OS #' || v_ordem.numero
          || coalesce(' — ' || v_veiculo_desc, '')
          || ' — ' || cf.nome,
        (v_item ->> 'categoria_id')::uuid,
        (v_item ->> 'valor')::numeric,
        current_date,
        v_ordem.cliente_id,
        null,
        null,
        p_created_by,
        jsonb_build_array(jsonb_build_object(
          'numero', 1,
          'valor', (v_item ->> 'valor')::numeric,
          'vencimento', p_vencimento
        )),
        p_ordem_id
      )
      into v_conta_id
      from public.categoria_financeira cf
      where cf.id = (v_item ->> 'categoria_id')::uuid;

      v_conta_ids := array_append(v_conta_ids, v_conta_id);
    end loop;
  end if;

  update public.ordem_servico
  set status = 'concluido',
      data_conclusao = now(),
      garantia_ate = (current_date + (garantia_meses || ' months')::interval)::date
  where id = p_ordem_id;

  return v_conta_ids;
end;
$$;

-- =========================================================================
-- (3) BACKFILL: OS já concluídas ganham a garantia retroativa (contada da
-- conclusão). Guardado por garantia_ate is null para ser idempotente.
-- =========================================================================

update public.ordem_servico
set garantia_ate = (data_conclusao::date + (garantia_meses || ' months')::interval)::date
where status = 'concluido'
  and data_conclusao is not null
  and garantia_ate is null;
