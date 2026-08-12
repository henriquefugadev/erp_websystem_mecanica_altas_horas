-- Recebimento em lote da OS numa transação só.
--
-- Antes, `receberPagamentoOsAction` fazia um laço na aplicação chamando
-- registrar_pagamento uma vez por parcela. Cada chamada é a sua própria
-- transação: se a terceira falhasse (saldo mudou em outra aba, parcela
-- cancelada no meio, queda de conexão), as duas primeiras já estavam gravadas e
-- o usuário via só "não foi possível registrar o recebimento" — com metade do
-- dinheiro lançado e nenhuma pista de qual metade.
--
-- Aqui o laço vive dentro de uma função plpgsql, que roda em UMA transação:
-- ou todas as parcelas são quitadas, ou nenhuma é. O `raise exception` de
-- registrar_pagamento (parcela já liquidada, valor acima do saldo) desfaz tudo
-- automaticamente.
--
-- Mantém a mesma regra do código que substitui: só contas do tipo 'receber'
-- ligadas à OS, não excluídas, e cada parcela é quitada pelo saldo integral
-- (valor - pago - desconto).

create or replace function public.receber_parcelas_da_os(
  p_ordem_id uuid,
  p_data_pagamento date,
  p_forma_pagamento text,
  p_observacoes text,
  p_created_by uuid
)
returns integer
language plpgsql
as $$
declare
  v_parcela record;
  v_saldo numeric(13, 2);
  v_pagas integer := 0;
begin
  -- `for update` na parcela evita que duas telas quitem a mesma OS ao mesmo
  -- tempo e lancem o dobro. A ordem por vencimento mantém o extrato legível.
  for v_parcela in
    select p.id, p.valor, p.valor_pago, p.desconto
    from public.parcela_financeira p
    join public.conta_financeira c on c.id = p.conta_id
    where c.ordem_servico_id = p_ordem_id
      and c.tipo = 'receber'
      and c.deleted_at is null
      and p.status in ('aberta', 'parcial')
    order by p.vencimento
    for update of p
  loop
    v_saldo := v_parcela.valor - v_parcela.valor_pago - v_parcela.desconto;
    if v_saldo <= 0 then
      continue;
    end if;

    perform public.registrar_pagamento(
      v_parcela.id,
      v_saldo,
      0,
      p_data_pagamento,
      p_forma_pagamento,
      p_observacoes,
      p_created_by
    );

    v_pagas := v_pagas + 1;
  end loop;

  if v_pagas = 0 then
    raise exception 'Não há saldo a receber nesta OS.';
  end if;

  return v_pagas;
end;
$$;

comment on function public.receber_parcelas_da_os is
  'Quita todas as parcelas a receber em aberto de uma OS numa transação só. Devolve quantas foram quitadas.';
