-- Fase 8 (fluxo real): fechar a OS e avisar o cliente que o carro está pronto.
-- O único dado novo é quando o cliente foi avisado — o resto (valor
-- pré-preenchido, mensagem de WhatsApp) é montado na aplicação a partir do que
-- já existe (orçamento aprovado, condições de pagamento da oficina).

alter table public.ordem_servico
  add column cliente_avisado_em timestamptz;
