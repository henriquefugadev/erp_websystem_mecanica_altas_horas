-- registrar_pagamento/estornar_pagamento (security invoker) chamam
-- app.recalcular_status_conta(uuid) diretamente em vez de via trigger.
-- Diferente das funções acionadas só por trigger (app.set_updated_at,
-- app.registrar_auditoria, ...), uma chamada direta dentro do corpo
-- plpgsql roda com os privilégios de quem invocou o RPC (authenticated),
-- e esse role nunca recebeu USAGE no schema app — só foi descoberto ao
-- testar no browser (a suíte pglite não reproduzia isso). Sem este grant:
-- "permission denied for schema app".
grant usage on schema app to authenticated;
grant execute on function app.recalcular_status_conta(uuid) to authenticated;
