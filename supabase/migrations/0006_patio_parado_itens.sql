-- Fase 3b: ajustes de uso real do pátio.
-- (1) Novo status 'parado': carro no meio da execução mas parado por motivo
--     legítimo (ex.: cliente trazendo peça aos poucos) — separado de
--     'em_execucao' pra Michele ver o que está de fato andando.
-- (2) Volta de 'em_execucao' pra 'aguardando' (desfazer início por engano).
-- (3) Conclusão com itens (mão de obra, peças, ...): cada item vira sua
--     própria conta a receber, ligada à OS. Troca o vínculo OS→conta de 1:1
--     pra 1:N — a FK passa a viver do lado de conta_financeira.

-- =========================================================================
-- STATUS 'parado'
-- =========================================================================

-- O CHECK de status foi criado inline em 0005 (sem nome explícito); acha o
-- nome real via catálogo em vez de supor a convenção de nomenclatura do
-- Postgres, pra não quebrar a migração se o nome gerado for diferente do
-- esperado. Filtra por constraint de uma única coluna (a de galpão também
-- menciona "status" no corpo do CHECK, então dá match em `ilike '%status%'`
-- — o filtro por conkey de tamanho 1 evita pegar a errada.
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
  check (status in ('aguardando', 'em_execucao', 'parado', 'concluido', 'cancelada'));

alter table public.ordem_servico add column data_pausa timestamptz;

-- Constraint de galpão foi criada com nome explícito em 0005.
alter table public.ordem_servico drop constraint ordem_servico_galpao_so_execucao;
alter table public.ordem_servico add constraint ordem_servico_galpao_so_execucao
  check (galpao is null or status in ('em_execucao', 'parado', 'concluido'));

-- =========================================================================
-- OS → CONTA(S): de 1:1 pra 1:N (itens da conclusão)
-- =========================================================================

alter table public.ordem_servico drop column conta_id;

alter table public.conta_financeira
  add column ordem_servico_id uuid references public.ordem_servico (id);

create index conta_financeira_ordem_servico_idx
  on public.conta_financeira (ordem_servico_id)
  where ordem_servico_id is not null;

-- Estende criar_conta_financeira com um parâmetro opcional no fim. Um
-- parâmetro novo muda a assinatura da função pro Postgres — CREATE OR
-- REPLACE não substitui nesse caso, cria uma sobrecarga — então a versão de
-- 11 parâmetros (0002) precisa ser removida explicitamente antes, senão toda
-- chamada com 11 argumentos vira ambígua entre as duas.
drop function if exists public.criar_conta_financeira(
  uuid, text, text, uuid, numeric, date, uuid, text, text, uuid, jsonb
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
  p_ordem_servico_id uuid default null
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
    data_emissao, cliente_id, fornecedor_nome, observacoes, created_by, ordem_servico_id
  ) values (
    p_workshop_id, p_tipo, p_descricao, p_categoria_id, p_valor_total,
    p_data_emissao, p_cliente_id, p_fornecedor_nome, p_observacoes, p_created_by, p_ordem_servico_id
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

-- Reescreve concluir_ordem_servico: agora recebe uma lista de itens
-- (categoria + valor) em vez de um valor único, e gera uma conta a receber
-- por item — cada item pode ser cobrado/pago em momentos diferentes.
-- Assinatura mudou de 5 pra 4 parâmetros (valor único -> lista de itens) —
-- mesmo motivo do drop acima: precisa remover a versão antiga explicitamente
-- pra não deixar as duas coexistindo.
drop function if exists public.concluir_ordem_servico(uuid, numeric, date, uuid, uuid);

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

  if p_itens is not null then
    for v_item in select * from jsonb_array_elements(p_itens)
    loop
      select public.criar_conta_financeira(
        v_ordem.workshop_id,
        'receber',
        'OS #' || v_ordem.numero || ' — ' || cf.nome,
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
