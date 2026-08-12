-- Fase (Parametrizações do pátio + catálogo de serviços):
-- (1) A oficina passa a mandar nos números que hoje estão fixos no código:
--     galpões (quantos, capacidade, nome de cada um), prazos de atenção do
--     quadro, garantia padrão e por quantos dias a OS concluída fica no pátio.
-- (2) Qual categoria financeira é "peça" e qual é "mão de obra" vira escolha
--     explícita — antes era adivinhado por regex no nome da categoria, e
--     renomear a categoria jogava todo o faturamento para o lado errado.
-- (3) Tabela servico_catalogo: serviços frequentes com preço padrão, para o
--     autocomplete do orçamento. Hoje o autocomplete só puxa peças do estoque,
--     que está desligado — ou seja, hoje a Michele digita tudo na mão.
--
-- IMPORTANTE: todo default aqui reproduz EXATAMENTE o comportamento atual
-- (3 galpões × 10 vagas, 24/48/48/168h, 3 meses, 7 dias). Ninguém vê mudança
-- nenhuma até entrar nas Configurações e mexer.

-- =========================================================================
-- (1) PARÂMETROS DO PÁTIO NA WORKSHOP
-- =========================================================================

alter table public.workshop
  -- Galpões/baias. O limite de 12 é só para o quadro continuar renderizável;
  -- a oficina real tem 3.
  add column galpoes_quantidade smallint not null default 3
    check (galpoes_quantidade between 1 and 12),
  add column galpao_capacidade smallint not null default 10
    check (galpao_capacidade between 1 and 99),
  -- Rótulo livre por galpão, na ordem ("Elevador", "Box Rápido"). Posição
  -- vazia ou array mais curto que a quantidade cai no "Galpão N" de sempre —
  -- assim dá para nomear só alguns.
  add column galpao_nomes text[] not null default '{}'::text[],

  -- Horas até o card ganhar o badge de atenção em cada coluna. Espelham as
  -- constantes de patio/domain/status.ts.
  add column sla_aguardando_horas smallint not null default 24
    check (sla_aguardando_horas between 1 and 8760),
  add column sla_confirmacao_horas smallint not null default 48
    check (sla_confirmacao_horas between 1 and 8760),
  add column sla_execucao_horas smallint not null default 48
    check (sla_execucao_horas between 1 and 8760),
  add column sla_parado_horas smallint not null default 168
    check (sla_parado_horas between 1 and 8760),

  -- Garantia do serviço aplicada na conclusão da OS (antes: 3 fixo no código
  -- do dialog E no default da coluna ordem_servico.garantia_meses).
  add column garantia_meses_padrao smallint not null default 3
    check (garantia_meses_padrao between 0 and 120),

  -- Por quantos dias a OS concluída continua aparecendo no quadro. O pátio é
  -- operacional, não histórico — ela nunca sai do banco, só da visão do dia.
  add column dias_os_concluida_quadro smallint not null default 7
    check (dias_os_concluida_quadro between 1 and 365),

  -- Categorias de receita usadas ao concluir a OS: item de natureza 'peca' cai
  -- em categoria_peca_id, 'servico' em categoria_mao_obra_id. Ficam nullable
  -- de propósito — sem escolha, o app cai no comportamento antigo (busca por
  -- nome), então nada quebra em oficina que ainda não configurou.
  add column categoria_peca_id uuid references public.categoria_financeira (id),
  add column categoria_mao_obra_id uuid references public.categoria_financeira (id);

-- Backfill: aponta as categorias usando exatamente o critério que o código
-- usava por regex, para o dia 1 ficar idêntico ao dia 0.
update public.workshop w
set categoria_peca_id = (
      select cf.id
      from public.categoria_financeira cf
      where cf.workshop_id = w.id
        and cf.tipo = 'receita'
        and cf.deleted_at is null
        and cf.nome ~* 'pe[çc]a'
      order by cf.nome
      limit 1
    ),
    categoria_mao_obra_id = (
      select cf.id
      from public.categoria_financeira cf
      where cf.workshop_id = w.id
        and cf.tipo = 'receita'
        and cf.deleted_at is null
        and lower(trim(cf.nome)) = 'mão de obra'
      order by cf.nome
      limit 1
    );

-- =========================================================================
-- (2) CONCLUSÃO USA A GARANTIA CONFIGURADA
-- Reescrita fiel da 0021, trocando só a origem dos meses de garantia: agora
-- vem da workshop e fica CARIMBADO em ordem_servico.garantia_meses. OS antigas
-- mantêm o que já foi carimbado; mudar a config só afeta conclusões futuras.
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
  v_garantia_meses smallint;
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

  -- Garantia configurada pela oficina; sem workshop (não deveria acontecer)
  -- mantém o que a própria OS já tinha.
  select w.garantia_meses_padrao into v_garantia_meses
  from public.workshop w
  where w.id = v_ordem.workshop_id;

  v_garantia_meses := coalesce(v_garantia_meses, v_ordem.garantia_meses);

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
      garantia_meses = v_garantia_meses,
      garantia_ate = (current_date + (v_garantia_meses || ' months')::interval)::date
  where id = p_ordem_id;

  return v_conta_ids;
end;
$$;

-- =========================================================================
-- (3) CATÁLOGO DE SERVIÇOS (por oficina)
-- Mesma forma do tipo_item_orcamento (0017): leitura para toda a oficina,
-- escrita só para admin, auditoria e updated_at por trigger.
-- =========================================================================

create table public.servico_catalogo (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshop (id),
  nome text not null,
  -- Preço sugerido; a Michele pode sobrescrever linha a linha no orçamento.
  -- 0 = "só o nome no autocomplete, preço eu digito na hora".
  preco_padrao numeric(13, 2) not null default 0 check (preco_padrao >= 0),
  -- Minutos estimados: alimenta o preço quando a oficina prefere cobrar por
  -- hora (valor_hora_mao_obra) em vez de preço fechado. Opcional.
  duracao_minutos smallint check (duracao_minutos is null or duracao_minutos > 0),
  ativo boolean not null default true,
  ordem smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Nome único por oficina (case-insensitive) — não deixa duplicar "Troca de óleo".
create unique index servico_catalogo_workshop_nome_key
  on public.servico_catalogo (workshop_id, lower(nome));
create index servico_catalogo_workshop_idx
  on public.servico_catalogo (workshop_id);

create trigger servico_catalogo_set_updated_at
  before update on public.servico_catalogo
  for each row execute function app.set_updated_at();

create trigger servico_catalogo_auditoria
  after insert or update or delete on public.servico_catalogo
  for each row execute function app.registrar_auditoria();

alter table public.servico_catalogo enable row level security;
alter table public.servico_catalogo force row level security;

create policy servico_catalogo_select on public.servico_catalogo
  for select to authenticated
  using (workshop_id in (select app.current_workshop_ids()));

create policy servico_catalogo_insert on public.servico_catalogo
  for insert to authenticated
  with check (
    workshop_id in (
      select workshop_id from public.usuario_workshop
      where usuario_id = auth.uid() and papel = 'admin'
    )
  );

create policy servico_catalogo_update on public.servico_catalogo
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

create policy servico_catalogo_delete on public.servico_catalogo
  for delete to authenticated
  using (
    workshop_id in (
      select workshop_id from public.usuario_workshop
      where usuario_id = auth.uid() and papel = 'admin'
    )
  );

-- Seed: os serviços mais comuns de oficina, sem preço (a oficina preenche o
-- dela). Já entram prontos para o autocomplete no primeiro uso.
insert into public.servico_catalogo (workshop_id, nome, ordem)
select w.id, v.nome, v.ordem
from public.workshop w
cross join (values
  ('Troca de óleo e filtro', 0),
  ('Alinhamento e balanceamento', 1),
  ('Revisão geral', 2),
  ('Troca de pastilhas de freio', 3),
  ('Troca de correia dentada', 4),
  ('Diagnóstico eletrônico (scanner)', 5),
  ('Troca de embreagem', 6),
  ('Suspensão — troca de amortecedores', 7)
) as v(nome, ordem)
on conflict do nothing;
