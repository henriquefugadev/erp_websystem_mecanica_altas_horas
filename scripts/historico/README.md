# Importação do histórico da oficina

Traz para o banco o histórico que estava no HD antigo (`Arquivos Importantes/`).
Nada aqui roda sozinho — os scripts só **geram SQL para revisão**.

## Ordem

```bash
python scripts/historico/1-extrair.py     # lê os .xlsx originais -> historico.json
python scripts/historico/2-gerar-sql.py   # historico.json -> 0024 + seed_historico.sql
```

Depois, no SQL Editor do Supabase: aplicar `supabase/migrations/0024_historico_import.sql`
e então `supabase/seed_historico.sql` (uma vez só).

## Decisões que valem lembrar

- **A planilha mestra não é a fonte das OS de planilha.** Ela achatou cada aba em
  uma linha resumo e perdeu os itens, as datas e o técnico. `1-extrair.py` lê os
  `.xlsx` originais direto: 945 linhas de item e 97% de datas, contra 0 e 0% na mestra.
- **Dedup é por conteúdo, nunca por nome de aba.** `PALIO WEKEEND.xlsx` tem abas
  `CROSSFOX`, `CROSSFOX ` e `CROSSFOX  ` que são OS *diferentes* (clientes e datas
  distintos). Deduplicar por nome apagava 44 registros reais. A impressão digital
  do bloco (data+cliente+veículo+placa+valor+itens) é que identifica cópia.
- **`CROSSFOX.xlsx` e `CORSA DANIEL.xlsx` não são subconjuntos puros** de
  `PALIO WEKEEND.xlsx`: têm 9 e 4 registros exclusivos. Não descartar por arquivo.
- **A OS não tem tabela de itens.** Os itens vivem em `orcamento_item`; por isso
  cada OS com itens ganha um `orcamento` vinculado por `orcamento.ordem_servico_id`
  (o mesmo desenho da RPC `criar_orcamento_da_os`).
- **O seed tem travas** que comparam preparado × gravado em cada tabela. Um `join`
  que não casa derruba a transação inteira em vez de perder linha em silêncio —
  foi assim que apareceram 16 veículos órfãos durante o desenvolvimento.
- **Toda trava conta só `import_origem is not null`.** O banco de produção já
  tinha orçamentos criados pela oficina; a primeira versão contava a tabela
  inteira e acusava diferença por causa de dado legítimo preexistente
  (`ORCAMENTO_ITEM: preparados 1086, gravados 1094`). `orcamento_item`,
  `parcela_financeira` e `pagamento_financeira` não têm `import_origem` própria —
  a contagem passa por `join` na tabela pai.
- **Placa já cadastrada aborta com a lista.** O índice único `(workshop_id, placa)`
  colidiria no meio do insert. Se acontecer, o histórico daquele carro tem de ser
  ligado ao veículo existente, não duplicado — decisão que precisa de gente.

## O banco de produção está atrás do repositório

Descoberto ao rodar o seed: a `0009` nunca foi aplicada no Supabase, então
`cliente.bairro` continuava `NOT NULL` lá. Como este banco recebe migração
manual (sem CLI linkado), outras podem faltar.

```bash
# leitura pura, mostra migração por migração o que já está aplicado
psql ... -f scripts/historico/diagnostico-schema.sql   # ou cole no SQL Editor
```

O seed tem um **preflight** que aborta antes de gravar qualquer linha, listando
de uma vez toda coluna faltante ou `NOT NULL` que ele não preenche — em vez de
falhar um erro por vez. O insert de cliente grava `''` em endereço/documento
opcionais para funcionar nos dois estados de schema; `cliente.documento` de
propósito **não** recebe `''` (sem a `0012` o índice único não tem filtro e 311
clientes colidiriam — melhor abortar e mandar aplicar a migração).

## Rode por psql, não pelo SQL Editor

O seed tem ~220 KB. O SQL Editor do Supabase quebra script desse tamanho em
pedaços, e aí duas coisas acontecem: as tabelas de apoio criadas no início
desaparecem (`relation "_cfg" does not exist`) e o `BEGIN/COMMIT` deixa de valer
como unidade. Por isso as tabelas de apoio são temporárias **de sessão**, não
`on commit drop`, e cada uma leva `drop table if exists` antes — assim o seed
funciona mesmo fatiado e pode ser reexecutado.

```bash
psql "<connection string>" -f supabase/seed_historico.sql
```

Se rodar pelo editor e parar no meio, use `desfazer-historico.sql` e recomece:
ele apaga só o que tem `import_origem`, sem tocar no que a oficina criou.

## O que ficou pendente de conferência humana

- 155 veículos com placa `SEM-PLACA-NNNN` (a origem não tinha placa).
- 30 clientes marcados em `notas` como identificação pendente (o nome é o carro,
  ou a origem não trazia nome nenhum).
- 14 OS em que o VALOR TOTAL declarado difere da soma dos itens — divergência que
  já existe na planilha de origem, não foi introduzida aqui. A pior é
  `PALIO WEKEEND.xlsx :: aba 'SAVEIRO CROSS'` (declarado 3.951,50 × itens 13.768,62).
- 92 lançamentos financeiros com data inferida do nome do arquivo
  (`BRUTO JULHO` → 01/07/2023; `MENSAL SETEMBRO` → 11/09/2023, data que está no
  título da própria planilha).
