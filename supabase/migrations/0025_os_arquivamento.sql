-- Arquivamento manual da OS no quadro do pátio.
--
-- O quadro já esconde sozinho as OS concluídas com mais de N dias
-- (workshop.dias_os_concluida_quadro, padrão 7) — é o "limpar de 7 em 7 dias".
-- Isso NÃO apaga nada: só tira da visão do dia a dia; a OS continua no banco,
-- no histórico do cliente e nos relatórios.
--
-- Esta coluna dá o mesmo efeito, só que na hora e por decisão da oficina: ao
-- arquivar uma OS já concluída, `arquivada_em` recebe o carimbo de tempo e o
-- card sai do quadro imediatamente, sem esperar os 7 dias. Continua sendo só
-- ocultação — nenhum dado é removido.
--
-- Nullable e sem default: OS não arquivada = arquivada_em IS NULL, que é o
-- estado de todas as OS existentes. Por isso o quadro (que hoje faz SELECT *)
-- não quebra entre publicar o código e rodar esta migração: o filtro de
-- arquivadas é feito na aplicação e trata a coluna ausente como "não arquivada".

alter table public.ordem_servico
  add column arquivada_em timestamptz;
