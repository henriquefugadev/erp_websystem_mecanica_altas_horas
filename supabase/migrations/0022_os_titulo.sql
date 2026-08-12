-- Nome (título) livre da OS: um rótulo curto que a oficina pode dar para
-- identificar a ordem além do "OS #numero" (ex.: "Revisão 20 mil", "Retorno
-- garantia", "Freios + suspensão"). Opcional — quando vazio, a tela continua
-- mostrando o veículo como antes.

alter table public.ordem_servico
  add column titulo text;
