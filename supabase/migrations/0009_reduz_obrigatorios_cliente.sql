-- Reduz o cadastro de cliente: bairro/cidade/UF deixam de ser obrigatórios
-- no formulário. cep, logradouro (exibido como "Endereço") e numero
-- continuam not null.
alter table public.cliente
  alter column bairro drop not null,
  alter column cidade drop not null,
  alter column estado drop not null;
