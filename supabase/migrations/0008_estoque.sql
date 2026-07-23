-- Fase 5: módulo Estoque — catálogo de peças + ledger de movimentações +
-- baixa automática ao consumir peça em OS. Ver docs/pesquisa/08.
--
-- Decisões de escopo (confirmadas com o usuário):
-- (1) Consumo de peça na OS é separado da cobrança: só baixa estoque e
--     registra o movimento ligado à OS; "Concluir OS" continua manual por
--     categoria, sem pré-preencher valor de peças.
-- (2) Entrada de estoque é manual na tela de Estoque neste ciclo — o módulo
--     Compras (0007) fica intacto: itens de pedido de compra continuam
--     descrição livre, sem virar peça de catálogo.

-- =========================================================================
-- TABELA: PEÇA (catálogo + cache de saldo)
-- estoque_atual e custo_medio são derivados do ledger (movimentacao_estoque)
-- e só mudam via trigger — nunca por UPDATE direto da aplicação (mesmo
-- espírito de "não confie em campo editável para saldo" do doc 08).
-- =========================================================================

create table public.peca (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshop (id),
  sku text,
  nome text not null,
  fabricante text,
  aplicacao text,
  unidade text not null default 'UN',
  localizacao text,
  preco_venda numeric(13, 2) not null default 0 check (preco_venda >= 0),
  custo_medio numeric(13, 2) not null default 0 check (custo_medio >= 0),
  estoque_minimo numeric(13, 3) not null default 0 check (estoque_minimo >= 0),
  estoque_atual numeric(13, 3) not null default 0 check (estoque_atual >= 0),
  ativo boolean not null default true,
  observacoes text,
  created_by uuid references public.usuario (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index peca_workshop_idx on public.peca (workshop_id)
  where deleted_at is null;
create unique index peca_workshop_sku_key
  on public.peca (workshop_id, sku)
  where deleted_at is null and sku is not null;
create index peca_workshop_nome_idx on public.peca (workshop_id, nome)
  where deleted_at is null;

-- =========================================================================
-- TABELA: MOVIMENTAÇÃO DE ESTOQUE (ledger imutável — só INSERT)
-- Livro-razão: nunca se apaga nem edita lançamento antigo, só adiciona.
-- quantidade é assinada (+ aumenta, - diminui); o CHECK garante que o sinal
-- bate com o tipo, então nem a RPC nem a aplicação podem inverter por engano.
-- =========================================================================

create table public.movimentacao_estoque (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshop (id),
  peca_id uuid not null references public.peca (id),
  tipo text not null
    check (tipo in ('entrada', 'saida_consumo', 'devolucao', 'perda', 'ajuste')),
  quantidade numeric(13, 3) not null,
  custo_unitario numeric(13, 2),
  ordem_servico_id uuid references public.ordem_servico (id),
  observacao text,
  created_by uuid references public.usuario (id),
  created_at timestamptz not null default now(),
  constraint movimentacao_estoque_sinal_por_tipo check (
    (tipo in ('entrada', 'devolucao') and quantidade > 0)
    or (tipo in ('saida_consumo', 'perda') and quantidade < 0)
    or (tipo = 'ajuste' and quantidade <> 0)
  )
);

create index movimentacao_estoque_peca_idx
  on public.movimentacao_estoque (peca_id, created_at);
create index movimentacao_estoque_workshop_idx
  on public.movimentacao_estoque (workshop_id);
create index movimentacao_estoque_ordem_servico_idx
  on public.movimentacao_estoque (ordem_servico_id)
  where ordem_servico_id is not null;

-- =========================================================================
-- TRIGGER: aplica o movimento no cache da peça (saldo + custo médio)
-- Trava a linha da peça (FOR UPDATE via SELECT ... FOR UPDATE não é possível
-- em trigger; usa UPDATE direto, que já toma o lock de linha do Postgres) —
-- protege contra corrida de duas movimentações simultâneas na mesma peça
-- (doc 08 §Concorrência).
-- =========================================================================

create or replace function app.aplicar_movimento_estoque()
returns trigger
language plpgsql
as $$
declare
  v_estoque_ant numeric(13, 3);
  v_custo_ant numeric(13, 2);
  v_novo_custo numeric(13, 2);
begin
  select estoque_atual, custo_medio into v_estoque_ant, v_custo_ant
  from public.peca
  where id = new.peca_id
  for update;

  if not found then
    raise exception 'Peça não encontrada.';
  end if;

  v_novo_custo := v_custo_ant;
  if new.tipo = 'entrada' and new.custo_unitario is not null then
    v_novo_custo := round(
      (v_estoque_ant * v_custo_ant + new.quantidade * new.custo_unitario)
      / (v_estoque_ant + new.quantidade),
      2
    );
  end if;

  update public.peca
  set estoque_atual = v_estoque_ant + new.quantidade,
      custo_medio = v_novo_custo
  where id = new.peca_id;

  return new;
end;
$$;

create trigger movimentacao_estoque_aplicar
  after insert on public.movimentacao_estoque
  for each row execute function app.aplicar_movimento_estoque();

-- =========================================================================
-- TRIGGERS updated_at + AUDITORIA
-- =========================================================================

create trigger peca_set_updated_at
  before update on public.peca
  for each row execute function app.set_updated_at();

create trigger peca_auditoria
  after insert or update or delete on public.peca
  for each row execute function app.registrar_auditoria();

create trigger movimentacao_estoque_auditoria
  after insert or update or delete on public.movimentacao_estoque
  for each row execute function app.registrar_auditoria();

-- =========================================================================
-- ROW LEVEL SECURITY
-- =========================================================================

alter table public.peca enable row level security;
alter table public.peca force row level security;
alter table public.movimentacao_estoque enable row level security;
alter table public.movimentacao_estoque force row level security;

create policy peca_select on public.peca
  for select to authenticated
  using (workshop_id in (select app.current_workshop_ids()));
create policy peca_insert on public.peca
  for insert to authenticated
  with check (workshop_id in (select app.current_workshop_ids()));
create policy peca_update on public.peca
  for update to authenticated
  using (workshop_id in (select app.current_workshop_ids()))
  with check (workshop_id in (select app.current_workshop_ids()));

-- movimentacao_estoque: só select + insert — sem policy de update/delete,
-- então nenhum role de aplicação consegue alterar ou apagar um lançamento
-- já feito (imutabilidade garantida no banco, não só por convenção).
create policy movimentacao_estoque_select on public.movimentacao_estoque
  for select to authenticated
  using (workshop_id in (select app.current_workshop_ids()));
create policy movimentacao_estoque_insert on public.movimentacao_estoque
  for insert to authenticated
  with check (workshop_id in (select app.current_workshop_ids()));

-- =========================================================================
-- RPC: consome peça numa OS em execução/parada — a baixa automática.
-- Trava OS e peça (FOR UPDATE) para não deixar duas baixas concorrentes
-- estourarem o saldo; bloqueia saldo insuficiente (doc 08 §Estoque negativo).
-- =========================================================================

create or replace function public.consumir_peca_os(
  p_ordem_id uuid,
  p_peca_id uuid,
  p_quantidade numeric,
  p_created_by uuid
)
returns uuid
language plpgsql
as $$
declare
  v_ordem record;
  v_peca record;
  v_mov_id uuid;
begin
  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'Quantidade deve ser maior que zero.';
  end if;

  select * into v_ordem
  from public.ordem_servico
  where id = p_ordem_id
  for update;

  if not found then
    raise exception 'Ordem de serviço não encontrada.';
  end if;

  if v_ordem.status not in ('em_execucao', 'parado') then
    raise exception 'OS está "%", só é possível usar peça com a OS em execução ou parada.', v_ordem.status;
  end if;

  select * into v_peca
  from public.peca
  where id = p_peca_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Peça não encontrada.';
  end if;

  if v_peca.estoque_atual < p_quantidade then
    raise exception 'Saldo insuficiente de "%": estoque atual é %, não é possível baixar %.',
      v_peca.nome, v_peca.estoque_atual, p_quantidade;
  end if;

  insert into public.movimentacao_estoque (
    workshop_id, peca_id, tipo, quantidade, custo_unitario, ordem_servico_id, created_by
  ) values (
    v_peca.workshop_id, p_peca_id, 'saida_consumo', -p_quantidade, v_peca.custo_medio, p_ordem_id, p_created_by
  )
  returning id into v_mov_id;

  return v_mov_id;
end;
$$;

-- =========================================================================
-- RPC: ajuste de inventário — corrige o saldo para a quantidade contada,
-- registrando a diferença como um único movimento de ajuste (com sinal).
-- =========================================================================

create or replace function public.ajustar_estoque(
  p_peca_id uuid,
  p_quantidade_contada numeric,
  p_observacao text,
  p_created_by uuid
)
returns uuid
language plpgsql
as $$
declare
  v_peca record;
  v_delta numeric(13, 3);
  v_mov_id uuid;
begin
  if p_quantidade_contada is null or p_quantidade_contada < 0 then
    raise exception 'Quantidade contada deve ser zero ou maior.';
  end if;

  select * into v_peca
  from public.peca
  where id = p_peca_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Peça não encontrada.';
  end if;

  v_delta := p_quantidade_contada - v_peca.estoque_atual;
  if v_delta = 0 then
    raise exception 'A quantidade contada já é igual ao estoque atual — nenhum ajuste necessário.';
  end if;

  insert into public.movimentacao_estoque (
    workshop_id, peca_id, tipo, quantidade, ordem_servico_id, observacao, created_by
  ) values (
    v_peca.workshop_id, p_peca_id, 'ajuste', v_delta, null, p_observacao, p_created_by
  )
  returning id into v_mov_id;

  return v_mov_id;
end;
$$;
