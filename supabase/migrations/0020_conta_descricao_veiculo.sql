-- Descrição das contas geradas na conclusão da OS passa a incluir o veículo
-- (modelo + cor), para facilitar a busca em Contas ("Gol prata", etc.).
-- Antes: "OS #12 — Mão de obra"; agora: "OS #12 — Gol Prata — Mão de obra".
-- Só muda a montagem da descrição; o resto da conclusão continua igual.

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
      data_conclusao = now()
  where id = p_ordem_id;

  return v_conta_ids;
end;
$$;

-- Backfill das contas a receber já existentes ligadas a uma OS: injeta o
-- veículo na descrição. Guardado por "não ter ainda dois travessões" para não
-- duplicar caso rode mais de uma vez.
update public.conta_financeira cf
set descricao = 'OS #' || os.numero
  || coalesce(' — ' || nullif(trim(
       coalesce(v.marca || ' ', '') || v.modelo || coalesce(' ' || v.cor, '')
     ), ''), '')
  || ' — ' || (select nome from public.categoria_financeira where id = cf.categoria_id)
from public.ordem_servico os
left join public.veiculo v on v.id = os.veiculo_id
where cf.ordem_servico_id = os.id
  and cf.tipo = 'receber'
  and cf.deleted_at is null
  and cf.descricao like 'OS #%'
  and (length(cf.descricao) - length(replace(cf.descricao, '—', ''))) < length('——');
