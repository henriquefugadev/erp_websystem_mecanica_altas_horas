# -*- coding: utf-8 -*-
"""Gera a migracao 0024 + o seed do historico a partir de historico.json.
Nao executa nada: so escreve arquivos .sql para revisao."""
import json, os, sys, re, datetime, unicodedata
from collections import Counter, defaultdict
sys.stdout.reconfigure(encoding="utf-8")

AQUI = os.path.dirname(os.path.abspath(__file__))
DEST = r"D:\HENRIQUE\TRABALHOS\GO JOVEM\MECANICA-ALTAS-HORAS-SISTEMA-WEB\web-system-mecanica-altas-horas\supabase\migrations"
H = json.load(open(os.path.join(AQUI, "historico.json"), encoding="utf-8"))

def sa(s): return unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode()
def q(s):
    if s is None: return "null"
    return "'" + str(s).replace("'", "''") + "'"
def qn(v):
    return "null" if v is None else f"{float(v):.2f}"

# ------------------------------------------------ classificacao peca/servico
SERV = ["MAO DE OBRA","LIMPEZA","ALINHAMENTO","BALANCEAMENTO","RETIFICA","REPARO",
        "INSTALACAO","REVISAO","DIAGNOSTICO","SOLDA","USINAGEM","PINTURA","HIGIENIZACAO",
        "SANGRIA","REGULAGEM","MONTAGEM","DESMONTAGEM","SERVICO","CONSERTO","RECUPERACAO",
        "LAVAGEM","POLIMENTO","GEOMETRIA","CAMBAGEM","MANUTENCAO","TROCA DE","TROCA DO",
        "TROCA DA","MAO-DE-OBRA","REPARAR","AJUSTE","CALIBRAGEM","TESTE"]
PROD = ["PRODUTO", "LIQUIDO", "SPRAY", "FRASCO"]
def tipo_item(desc):
    t = re.sub(r"\s+", " ", sa(desc).upper())
    if any(k in t for k in PROD): return "peca"
    return "servico" if any(k in t for k in SERV) else "peca"

# ------------------------------------------------------------ pre-computo
clientes = H["clientes"]; veiculos = H["veiculos"]
ordens = H["ordens"]; fin = H["financeiro"]

def nk(s):
    if s is None: return ""
    t = re.sub(r"[^A-Z0-9 ]", " ", sa(s).upper())
    return re.sub(r"\s+", " ", t).strip()

# telefone do financeiro -> cliente
tel = {}
for f in fin:
    c = nk(f.get("cliente")); t = str(f.get("contato") or "").strip()
    if c and t and c not in tel: tel[c] = t[:40]

# chave de veiculo -> placa final
vkey_placa, vkey_modelo = {}, {}
for v in veiculos:
    k = tuple(v["chave"])
    vkey_placa[k] = v["placa"] or v.get("placa_sintetica")
    vkey_modelo[k] = (sorted(v["modelos"], key=len)[-1] if v["modelos"] else "(nao informado)")

# Registros em que a origem nao traz NENHUM nome de cliente (nem pessoa nem
# carro). Nao ha nome a preservar, entao vao para um titular provisorio unico,
# marcado como pendente — o veiculo, a placa e o arquivo de origem seguem
# intactos no registro, que e o que permite identificar depois.
# Alternativa descartada: descartar esses registros (perderia servico real).
SEM_NOME = "(SEM IDENTIFICACAO NA ORIGEM)"

def cli_key(r):
    return nk(r.get("cliente")) or SEM_NOME

def veic_key(r):
    if r.get("placa"): return ("placa", r["placa"])
    return ("cli", cli_key(r), nk(r.get("veiculo")))

# Titular provisorio entra na lista de clientes se algum registro precisar dele.
precisa_sem_nome = any(
    not nk(r.get("cliente"))
    for r in ordens
) or any(not nk(f.get("cliente")) for f in fin)
if precisa_sem_nome and not any(c["chave"] == SEM_NOME for c in clientes):
    clientes.append({"chave": SEM_NOME, "nome": "(sem identificacao na origem)",
                     "variantes": [], "origens": ["registros sem nome de cliente"],
                     "veiculo_like": True})

# Veiculos cujo unico registro nao tinha cliente ficam com o titular provisorio.
for v in veiculos:
    if not v["clientes"]:
        v["clientes"] = [SEM_NOME]

def caminho(r):
    """Caminho relativo do arquivo original, no mesmo layout que vai pro
    Storage (bucket 'historico'): '<pasta>/<arquivo>'. Sem a pasta o link
    ficaria ambiguo — ha nomes iguais em pastas diferentes."""
    arq = str(r.get("arquivo") or "").strip()
    if not arq: return None
    pasta = str(r.get("pasta") or "").strip()
    return (f"{pasta}/{arq}" if pasta else arq)[:250]

# ------------------------------------------------ relatorio de classificacao
todos_itens = [i for r in ordens for i in r["itens"]]
cls = Counter(tipo_item(str(i["descricao"])) for i in todos_itens)
print(f"itens: {len(todos_itens)}  -> {dict(cls)}")
print("amostra classificada como SERVICO:")
vis = set()
for i in todos_itens:
    if tipo_item(str(i["descricao"])) == "servico" and i["descricao"].upper() not in vis:
        vis.add(i["descricao"].upper()); print("   ", i["descricao"].strip()[:60])
    if len(vis) >= 12: break

# ------------------------------------------------------------ 0024 migracao
mig = """-- Importacao do historico da oficina (arquivos do HD antigo).
-- Apenas RASTREABILIDADE: nenhuma tabela de negocio nova. Cada registro
-- importado guarda de qual arquivo/aba ele veio, para poder ser conferido
-- ou desfeito depois. O dado bruto NAO fica no banco (vive nos .xlsx/PDF
-- originais e no historico.json gerado na extracao).

alter table public.cliente          add column if not exists import_origem text;
alter table public.veiculo          add column if not exists import_origem text;
alter table public.ordem_servico    add column if not exists import_origem text,
                                    add column if not exists import_arquivo text;
alter table public.orcamento        add column if not exists import_origem text,
                                    add column if not exists import_arquivo text;
alter table public.conta_financeira add column if not exists import_origem text;

comment on column public.cliente.import_origem is
  'Arquivo/aba de origem quando o registro veio da importacao do historico; null = cadastrado no sistema.';
comment on column public.ordem_servico.import_arquivo is
  'Caminho do arquivo original no Storage (bucket historico), quando houver.';

-- Indices parciais: so as linhas importadas entram, entao custam quase nada
-- e tornam barato listar/limpar o lote inteiro.
create index if not exists cliente_import_idx
  on public.cliente (workshop_id) where import_origem is not null;
create index if not exists ordem_servico_import_idx
  on public.ordem_servico (workshop_id) where import_origem is not null;
"""
open(os.path.join(DEST, "0024_historico_import.sql"), "w", encoding="utf-8").write(mig)
print(f"\n-> 0024_historico_import.sql ({len(mig)} bytes)")

# ------------------------------------------------------------ seed
L = []
w = L.append
w("""-- ============================================================================
-- SEED: historico da Mecanica Altas Horas (arquivos do HD antigo)
-- Gerado automaticamente. NAO e uma migracao: rode UMA vez.
-- Requer a migracao 0024_historico_import.sql aplicada antes.
--
-- COMO RODAR (nesta ordem de preferencia):
--
--   1. psql  <- recomendado. Sao ~220 KB; o SQL Editor do Supabase quebra
--      scripts desse tamanho e as tabelas de apoio se perdem no meio.
--        psql "<connection string do projeto>" -f supabase/seed_historico.sql
--      Ai o arquivo inteiro roda numa transacao so: se algo falhar, NADA entra.
--
--   2. SQL Editor: funciona, mas se ele dividir a execucao o BEGIN/COMMIT
--      abaixo deixa de valer como unidade, e uma falha no meio pode deixar
--      dado pela metade. Se isso acontecer, rode
--      scripts/historico/desfazer-historico.sql e comece de novo.
--
-- As tabelas de apoio (_cfg, _cli, ...) sao temporarias de SESSAO, de proposito:
-- com "on commit drop" elas sumiriam entre um pedaco e outro no SQL Editor.
-- Para simular sem gravar, troque o COMMIT final por ROLLBACK.
-- ============================================================================
begin;

-- Oficina alvo: falha de proposito se houver 0 ou >1 oficina, para nao
-- adivinhar em qual banco o historico deve entrar.
drop table if exists _cfg;
create temp table _cfg as
select id as workshop_id from public.workshop;

do $$
declare n int;
begin
  select count(*) into n from _cfg;
  if n <> 1 then
    raise exception 'Esperava exatamente 1 oficina, encontrei %. Filtre _cfg manualmente.', n;
  end if;
end $$;

-- ============================================================================
-- PREFLIGHT: o banco esta no mesmo ponto que as migracoes do repositorio?
-- Bancos que receberam migracao manual costumam ficar defasados. Sem isto, a
-- defasagem apareceria como um erro por vez, a cada tentativa de rodar o seed.
-- Aqui ela aparece INTEIRA, de uma vez, antes de gravar qualquer linha.
-- ============================================================================
do $$
declare
  faltando text;
  obrigatorias text;
begin
  -- (1) Colunas que o seed escreve e que so existem a partir de certas migracoes.
  select string_agg(format('%s.%s (migracao %s)', t, c, m), E'\\n  ' order by t, c)
  into faltando
  from (values
    ('cliente','import_origem','0024'),
    ('veiculo','import_origem','0024'),
    ('ordem_servico','import_origem','0024'),
    ('ordem_servico','import_arquivo','0024'),
    ('orcamento','import_origem','0024'),
    ('orcamento','import_arquivo','0024'),
    ('conta_financeira','import_origem','0024'),
    ('ordem_servico','funcionario_id','0007'),
    ('ordem_servico','garantia_meses','0021'),
    ('ordem_servico','garantia_ate','0021'),
    ('orcamento','ordem_servico_id','0011'),
    ('orcamento_item','tipo_nome','0017')
  ) as req(t, c, m)
  where not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = req.t and column_name = req.c);

  if faltando is not null then
    raise exception E'Banco defasado: faltam colunas.\\n  %\\n\\nAplique as migracoes indicadas antes de rodar este seed.', faltando;
  end if;

  -- (2) Colunas NOT NULL sem default que o seed NAO preenche: sao exatamente as
  -- que fariam o insert estourar. Comparado com a lista do que cada insert
  -- escreve (numero entra por trigger, por isso esta liberado).
  select string_agg(format('%s.%s', c.table_name, c.column_name), E'\\n  '
                    order by c.table_name, c.column_name)
  into obrigatorias
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.is_nullable = 'NO'
    and c.column_default is null
    and c.table_name in ('cliente','veiculo','funcionario','ordem_servico',
                         'orcamento','orcamento_item','conta_financeira',
                         'parcela_financeira','pagamento_financeira')
    and (c.table_name, c.column_name) not in (
      values
        ('cliente','id'),('cliente','workshop_id'),('cliente','tipo'),('cliente','nome'),
        ('cliente','telefone'),('cliente','bairro'),('cliente','cidade'),('cliente','estado'),
        ('cliente','cep'),('cliente','logradouro'),('cliente','numero'),
        -- 'documento' NAO entra aqui de proposito: sem a 0012 o indice unico e
        -- (workshop_id, documento) sem filtro, entao gravar '' em 311 clientes
        -- colidiria. Melhor abortar e mandar aplicar a 0012.
        ('veiculo','id'),('veiculo','workshop_id'),('veiculo','cliente_id'),
        ('veiculo','placa'),('veiculo','modelo'),
        ('funcionario','id'),('funcionario','workshop_id'),('funcionario','nome'),
        ('ordem_servico','id'),('ordem_servico','workshop_id'),('ordem_servico','numero'),
        ('ordem_servico','cliente_id'),('ordem_servico','veiculo_id'),
        ('ordem_servico','status'),('ordem_servico','queixa'),
        ('orcamento','id'),('orcamento','workshop_id'),('orcamento','numero'),
        ('orcamento','cliente_id'),('orcamento','veiculo_id'),('orcamento','queixa'),
        ('orcamento','status'),('orcamento','valor_total'),('orcamento','validade'),
        ('orcamento_item','id'),('orcamento_item','workshop_id'),('orcamento_item','orcamento_id'),
        ('orcamento_item','tipo'),('orcamento_item','descricao'),
        ('orcamento_item','quantidade'),('orcamento_item','preco_unitario'),
        ('conta_financeira','id'),('conta_financeira','workshop_id'),('conta_financeira','tipo'),
        ('conta_financeira','descricao'),('conta_financeira','categoria_id'),
        ('conta_financeira','valor_total'),
        ('parcela_financeira','id'),('parcela_financeira','workshop_id'),
        ('parcela_financeira','conta_id'),('parcela_financeira','numero'),
        ('parcela_financeira','valor'),('parcela_financeira','vencimento'),
        ('pagamento_financeira','id'),('pagamento_financeira','workshop_id'),
        ('pagamento_financeira','parcela_id'),('pagamento_financeira','valor'),
        ('pagamento_financeira','forma_pagamento')
    );

  if obrigatorias is not null then
    raise exception E'Colunas NOT NULL que este seed nao preenche:\\n  %\\n\\nProvavelmente o banco esta atras do repositorio (ex: 0009/0012 tornam endereco e documento opcionais).', obrigatorias;
  end if;
end $$;

-- So agora da para checar isto: depende de import_origem ja existir.
do $$
declare ja int;
begin
  if exists (select 1 from public.cliente where import_origem is not null) then
    raise exception 'Historico ja importado (existe cliente com import_origem). Abortando.';
  end if;

  -- O banco em uso ja tem dado real da oficina? Isto e normal e nao impede o
  -- import; fica registrado no log para a conferencia final fazer sentido.
  select count(*) into ja from public.ordem_servico;
  if ja > 0 then
    raise notice 'Banco ja tem % OS criadas no sistema. As importadas recebem numero na sequencia (as historicas virao DEPOIS das atuais).', ja;
  end if;
end $$;

-- Endereco em branco: ver a nota no insert de cliente, mais abaixo.
""")

# --- clientes
w("\n-- ---------------------------------------------------------------- CLIENTES")
w("drop table if exists _cli;")
w("create temp table _cli (chave text primary key, nome text, telefone text,"
  " pendente boolean, origem text, id uuid);")
w("insert into _cli (chave, nome, telefone, pendente, origem) values")
linhas = []
for c in clientes:
    orig = c["origens"][0] if c["origens"] else "planilha-mestra"
    linhas.append(f"  ({q(c['chave'])}, {q(c['nome'])}, {q(tel.get(c['chave'], ''))}, "
                  f"{'true' if c['veiculo_like'] else 'false'}, {q(orig[:200])})")
w(",\n".join(linhas) + ";")
w("""
update _cli set id = gen_random_uuid();
-- bairro/cidade/estado: a migracao 0009 deixou os tres opcionais, mas bancos
-- que nao a receberam ainda os tem NOT NULL. Gravar string vazia funciona nos
-- dois casos e nao inventa endereco. O preflight acima avisa se o banco estiver
-- defasado; aplicar a 0009 torna estas tres colunas dispensaveis aqui.
insert into public.cliente (id, workshop_id, tipo, nome, telefone, import_origem,
                            notas, bairro, cidade, estado, cep, logradouro, numero)
select c.id, f.workshop_id, 'PF', c.nome, c.telefone,
       'historico:' || c.origem,
       case when c.pendente then 'Importado do historico: o nome parece ser o VEICULO, nao a pessoa. Identificacao pendente.' end,
       '', '', '', '', '', ''
from _cli c cross join _cfg f;""")

# --- veiculos
# Construido a partir dos PROPRIOS registros, nao so da lista da extracao: se
# um veiculo referenciado por uma OS faltasse aqui, o join da OS a descartaria
# em silencio (e os itens dela ficariam orfaos). Toda chave usada por algum
# registro existe nesta tabela, por construcao.
w("\n-- ---------------------------------------------------------------- VEICULOS")
w("drop table if exists _vei;")
w("create temp table _vei (vk text primary key, cli_chave text, placa text,"
  " modelo text, origem text, id uuid);")

vei = {}
for v in veiculos:                       # o que a extracao ja consolidou
    k = tuple(v["chave"])
    # So a placa REAL: a provisoria e numerada uma unica vez, no fim deste
    # bloco, senao a numeracao da extracao colide com a dos orfaos.
    vei[k] = {"cli": (v["clientes"][0] if v["clientes"] else SEM_NOME),
              "placa": v["placa"], "modelo": vkey_modelo[k],
              "origem": (v["origens"][0] if v["origens"] else "")}
usadas = set(vei)
faltando = 0
for r in ordens:                         # e o que os registros exigem
    k = veic_key(r)
    if k in vei: continue
    faltando += 1
    vei[k] = {"cli": cli_key(r), "placa": r.get("placa"),
              "modelo": (str(r.get("veiculo") or "").strip()[:80] or "(nao informado)"),
              "origem": r["origem"]}
if faltando:
    print(f"  veiculos criados a partir de registros orfaos: {faltando}")

# Numera as placas provisorias so no fim, para a sequencia sair estavel.
n = 0
for k in sorted(vei, key=lambda x: "|".join(map(str, x))):
    if not vei[k]["placa"]:
        n += 1; vei[k]["placa"] = f"SEM-PLACA-{n:04d}"
print(f"  veiculos totais={len(vei)}  placa real={len(vei)-n}  placa provisoria={n}")

linhas = [f"  ({q('|'.join(map(str, k)))}, {q(v['cli'])}, {q(v['placa'])}, "
          f"{q(v['modelo'][:80])}, {q(v['origem'][:200])})"
          for k, v in vei.items()]
w("insert into _vei (vk, cli_chave, placa, modelo, origem) values")
w(",\n".join(linhas) + ";")
w("""
update _vei set id = gen_random_uuid();

-- Placa que a oficina JA cadastrou no sistema colidiria com o indice unico
-- (workshop_id, placa) no meio do insert. Aqui isso vira uma lista legivel em
-- vez de "duplicate key value violates unique constraint".
do $$
declare colisao text;
begin
  select string_agg(format('%s (%s)', v.placa, v.modelo), E'\\n  ' order by v.placa)
    into colisao
    from _vei v
    join public.veiculo ex
      on ex.placa = v.placa and ex.deleted_at is null and ex.import_origem is null;
  if colisao is not null then
    raise exception E'Estas placas ja existem no sistema:\\n  %\\n\\nO historico delas precisa ser ligado ao veiculo que ja esta cadastrado, em vez de criar outro. Me avise para tratar esses casos.', colisao;
  end if;
end $$;

insert into public.veiculo (id, workshop_id, cliente_id, placa, modelo, import_origem, notas)
select v.id, f.workshop_id, c.id, v.placa, v.modelo, 'historico:' || v.origem,
       case when v.placa like 'SEM-PLACA-%%'
            then 'Placa nao consta na origem; codigo provisorio para conferencia.' end
from _vei v join _cli c on c.chave = v.cli_chave cross join _cfg f;""")

# --- funcionarios (quem assina "SERVICO FEITO POR" nas planilhas)
w("\n-- ----------------------------------------------------------- FUNCIONARIOS")
w("-- ordem_servico.tecnico (texto) virou funcionario_id (FK) na migracao 0007,")
w("-- entao quem assina as OS do historico entra como funcionario de fato.")
tecs = {}
for r in ordens:
    t = str(r.get("tecnico") or "").strip()
    if not t: continue
    # "PAULO / JADSON": a OS comporta um responsavel so -> fica o primeiro, e o
    # texto original vai para a descricao da OS (nada se perde).
    principal = re.split(r"[/,]", t)[0].strip()
    k = nk(principal)
    if k and k not in tecs: tecs[k] = principal.title()
w("drop table if exists _func;")
w("create temp table _func (chave text primary key, nome text, id uuid);")
w("insert into _func (chave, nome) values")
w(",\n".join(f"  ({q(k)}, {q(v)})" for k, v in sorted(tecs.items())) + ";")
w("""
update _func set id = gen_random_uuid();
insert into public.funcionario (id, workshop_id, nome, funcao, observacoes)
select f.id, w.workshop_id, f.nome, 'Mecanico',
       'Importado do historico (assinava SERVICO FEITO POR nas planilhas).'
from _func f cross join _cfg w;""")

# --- ordens de servico
w("\n-- ------------------------------------------------------- ORDENS DE SERVICO")
w("drop table if exists _os;")
w("create temp table _os (ref int primary key, cli_chave text, vk text, data date,"
  " func_chave text, tecnico_bruto text, valor numeric(13,2), arquivo text,"
  " origem text, sem_data boolean, id uuid);")
linhas, os_map, ref = [], {}, 0
for r in ordens:
    if r["tipo"] != "os": continue
    ck = cli_key(r); vk = veic_key(r)
    ref += 1; os_map[id(r)] = ref
    tb = str(r.get("tecnico") or "").strip()
    fk = nk(re.split(r"[/,]", tb)[0].strip()) if tb else ""
    linhas.append(f"  ({ref}, {q(ck)}, {q('|'.join(map(str, vk)))}, "
                  f"{q(r['data']) if r['data'] else 'null'}, {q(fk or None)}, {q(tb[:60] or None)}, "
                  f"{qn(r.get('valor_total'))}, {q(caminho(r))}, "
                  f"{q(r['origem'][:250])}, {'false' if r['data'] else 'true'})")
w("insert into _os (ref, cli_chave, vk, data, func_chave, tecnico_bruto, valor, arquivo, origem, sem_data) values")
w(",\n".join(linhas) + ";")
w("""
update _os set id = gen_random_uuid();
-- Insere em ordem cronologica para que o numero sequencial da OS (atribuido
-- pela trigger app.set_numero_os) siga a ordem real dos servicos.
insert into public.ordem_servico (
  id, workshop_id, cliente_id, veiculo_id, status, funcionario_id,
  data_abertura, data_conclusao, garantia_meses, garantia_ate,
  import_origem, import_arquivo, descricao)
select o.id, f.workshop_id, c.id, v.id, 'concluido', fu.id,
       coalesce(o.data::timestamptz, now()),
       o.data::timestamptz,
       3,
       case when o.data is not null then o.data + interval '3 months' end::date,
       'historico:' || o.origem,
       o.arquivo,
       nullif(concat_ws(' ',
         case when o.sem_data then 'Importado do historico: data nao consta na origem.' end,
         case when o.tecnico_bruto ~ '[/,]'
              then 'Responsavel na origem: ' || o.tecnico_bruto || '.' end), '')
from _os o
join _cli c on c.chave = o.cli_chave
join _vei v on v.vk = o.vk
left join _func fu on fu.chave = o.func_chave
cross join _cfg f
order by o.data nulls last, o.ref;""")

# --- orcamentos vinculados as OS (portadores dos itens)
w("\n-- --------------------------- ORCAMENTO DA OS (portador das linhas de item)")
w("-- ordem_servico nao tem tabela de itens: os itens de um servico vivem em")
w("-- orcamento_item, ligados por orcamento.ordem_servico_id (mesmo desenho que")
w("-- a RPC criar_orcamento_da_os usa no fluxo normal do patio).")
w("drop table if exists _orc_os;")
w("create temp table _orc_os (ref int primary key, os_ref int, total numeric(13,2),"
  " id uuid);")
linhas, oref = [], 0
itens_rows = []
for r in ordens:
    if r["tipo"] != "os" or not r["itens"]: continue
    if id(r) not in os_map: continue
    oref += 1
    tot = sum((i["total"] or 0) for i in r["itens"]) + (r.get("mao_de_obra") or 0)
    linhas.append(f"  ({oref}, {os_map[id(r)]}, {qn(tot)})")
    for i in r["itens"]:
        qtd = i["quantidade"] or 1
        pu = i["preco_unitario"]
        if pu is None:
            pu = (i["total"] / qtd) if (i["total"] and qtd) else 0
        itens_rows.append((oref, tipo_item(str(i["descricao"])), str(i["descricao"]).strip()[:200], qtd, pu))
    if r.get("mao_de_obra"):
        itens_rows.append((oref, "servico", "MAO DE OBRA", 1, r["mao_de_obra"]))
w("insert into _orc_os (ref, os_ref, total) values")
w(",\n".join(linhas) + ";")
w("""
update _orc_os set id = gen_random_uuid();
insert into public.orcamento (
  id, workshop_id, cliente_id, veiculo_id, queixa, status, valor_total,
  data_emissao, validade, ordem_servico_id, import_origem, import_arquivo)
select r.id, f.workshop_id, os.cliente_id, os.veiculo_id,
       'Servico executado (importado do historico)', 'aprovado', r.total,
       coalesce(os.data_conclusao::date, current_date),
       coalesce(os.data_conclusao::date, current_date) + 10,
       os.id, os.import_origem, os.import_arquivo
from _orc_os r
join _os t on t.ref = r.os_ref
join public.ordem_servico os on os.id = t.id
cross join _cfg f;

-- Elo reverso: a OS aponta para o orcamento corrente.
update public.ordem_servico os
set orcamento_id = r.id
from _orc_os r join _os t on t.ref = r.os_ref
where os.id = t.id;""")

w("\ndrop table if exists _item;")
w("create temp table _item (orc_ref int, tipo text, descricao text,"
  " quantidade numeric(13,3), preco numeric(13,2));")
w("insert into _item (orc_ref, tipo, descricao, quantidade, preco) values")
w(",\n".join(f"  ({a}, {q(b)}, {q(c)}, {float(d):.3f}, {qn(e)})" for a, b, c, d, e in itens_rows) + ";")
w("""
insert into public.orcamento_item (
  workshop_id, orcamento_id, tipo, tipo_nome, descricao, quantidade,
  preco_unitario, aprovado)
select f.workshop_id, r.id, i.tipo,
       case i.tipo when 'peca' then 'Peça' else 'Serviço' end,
       i.descricao, i.quantidade, coalesce(i.preco, 0), true
from _item i join _orc_os r on r.ref = i.orc_ref cross join _cfg f;""")

# --- orcamentos avulsos (pasta 02)
w("\n-- ------------------------------------------ ORCAMENTOS AVULSOS (pasta 02)")
w("drop table if exists _orc;")
w("create temp table _orc (ref int primary key, cli_chave text, vk text, data date,"
  " valor numeric(13,2), arquivo text, origem text, id uuid);")
linhas, aref = [], 0
for r in ordens:
    if r["tipo"] != "orcamento": continue
    ck = cli_key(r); vk = veic_key(r)
    aref += 1
    linhas.append(f"  ({aref}, {q(ck)}, {q('|'.join(map(str, vk)))}, "
                  f"{q(r['data']) if r['data'] else 'null'}, {qn(r.get('valor_total'))}, "
                  f"{q(caminho(r))}, {q(r['origem'][:250])})")
w("insert into _orc (ref, cli_chave, vk, data, valor, arquivo, origem) values")
w(",\n".join(linhas) + ";")
w("""
update _orc set id = gen_random_uuid();
insert into public.orcamento (
  id, workshop_id, cliente_id, veiculo_id, queixa, status, valor_total,
  data_emissao, validade, import_origem, import_arquivo)
select o.id, f.workshop_id, c.id, v.id,
       'Orcamento importado do historico', 'aprovado', coalesce(o.valor, 0),
       coalesce(o.data, current_date), coalesce(o.data, current_date) + 10,
       'historico:' || o.origem, o.arquivo
from _orc o
join _cli c on c.chave = o.cli_chave
join _vei v on v.vk = o.vk
cross join _cfg f
order by o.data nulls last, o.ref;""")

# --- financeiro
w("\n-- ------------------------------------------------------------- FINANCEIRO")
w("-- Uma conta por natureza (Pecas / Mao de obra), usando as categorias de")
w("-- receita ja semeadas pela oficina. Liquidadas, com data historica: o painel")
w("-- de faturamento filtra por data_emissao, entao nao inflam o mes corrente.")
w("drop table if exists _fin;")
w("create temp table _fin (ref int primary key, cli_chave text, descricao text,"
  " data date, pecas numeric(13,2), mao numeric(13,2), outras numeric(13,2),"
  " forma text, origem text);")
linhas = []
for i, f in enumerate(fin, 1):
    ck = nk(f.get("cliente")) or SEM_NOME
    pcs, mo, tot = f.get("pecas"), f.get("mao_de_obra"), f.get("total")
    # Linha so com TOTAL (sem separar peca de mao de obra) nao pode virar duas
    # contas: entra inteira em "Outras receitas" para nao sumir do faturamento.
    outras = None
    if not (pcs or mo):
        if not tot or tot <= 0: continue
        outras = tot
    desc = str(f.get("servico") or "Servico (historico)").strip()[:150]
    linhas.append(f"  ({i}, {q(ck)}, {q(desc)}, {q(f['data']) if f['data'] else 'null'}, "
                  f"{qn(pcs)}, {qn(mo)}, {qn(outras)}, "
                  f"{q(f.get('forma_pagamento'))}, {q(f['origem'][:200])})")
w("insert into _fin (ref, cli_chave, descricao, data, pecas, mao, outras, forma, origem) values")
w(",\n".join(linhas) + ";")
w("""
drop table if exists _conta;
create temp table _conta (id uuid, ref int, valor numeric(13,2), data date,
                          forma text);

with alvo as (
  select f.ref, f.cli_chave, f.descricao, f.data, f.origem, f.forma, n.nome, n.valor
  from _fin f
  cross join lateral (values ('Peças', f.pecas), ('Mão de obra', f.mao),
                             ('Outras receitas', f.outras)) as n(nome, valor)
  where n.valor is not null and n.valor > 0
),
ins as (
  insert into public.conta_financeira (
    workshop_id, tipo, descricao, cliente_id, categoria_id, valor_total,
    data_emissao, status, import_origem)
  select w.workshop_id, 'receber', a.descricao || ' — ' || a.nome, c.id, cat.id,
         a.valor, coalesce(a.data, current_date), 'liquidada', 'historico:' || a.origem
  from alvo a
  join _cli c on c.chave = a.cli_chave
  cross join _cfg w
  join public.categoria_financeira cat
    on cat.workshop_id = w.workshop_id and cat.tipo = 'receita' and cat.nome = a.nome
  returning id, valor_total, data_emissao, import_origem)
insert into _conta (id, ref, valor, data, forma)
select i.id, f.ref, i.valor_total, i.data_emissao, f.forma
from ins i join _fin f on 'historico:' || f.origem = i.import_origem;

-- Parcela unica ja quitada + o pagamento correspondente.
insert into public.parcela_financeira (
  workshop_id, conta_id, numero, valor, vencimento, valor_pago, status)
select w.workshop_id, k.id, 1, k.valor, k.data, k.valor, 'liquidada'
from _conta k cross join _cfg w;

insert into public.pagamento_financeira (
  workshop_id, parcela_id, valor, data_pagamento, forma_pagamento, observacoes)
select w.workshop_id, p.id, p.valor, p.vencimento,
       coalesce(k.forma, 'dinheiro'),
       case when k.forma is null then 'Forma de pagamento nao consta na origem; assumido dinheiro.' end
from _conta k
join public.parcela_financeira p on p.conta_id = k.id
cross join _cfg w;""")

w("""
-- ============================================================================
-- TRAVAS: cada registro preparado tem de ter virado linha no banco.
-- Um join que nao casa descartaria a linha EM SILENCIO; aqui isso vira erro
-- e a transacao inteira volta atras.
-- ============================================================================
do $$
declare
  esperado int; obtido int;
begin
  select count(*) into esperado from _cli;
  select count(*) into obtido from public.cliente where import_origem is not null;
  if esperado <> obtido then
    raise exception 'CLIENTE: preparados %, gravados %', esperado, obtido; end if;

  select count(*) into esperado from _vei;
  select count(*) into obtido from public.veiculo where import_origem is not null;
  if esperado <> obtido then
    raise exception 'VEICULO: preparados %, gravados %', esperado, obtido; end if;

  select count(*) into esperado from _os;
  select count(*) into obtido from public.ordem_servico where import_origem is not null;
  if esperado <> obtido then
    raise exception 'ORDEM_SERVICO: preparadas %, gravadas %', esperado, obtido; end if;

  select (select count(*) from _orc_os) + (select count(*) from _orc) into esperado;
  select count(*) into obtido from public.orcamento where import_origem is not null;
  if esperado <> obtido then
    raise exception 'ORCAMENTO: preparados %, gravados %', esperado, obtido; end if;

  -- So as linhas DESTA importacao: o banco ja pode ter itens/parcelas de
  -- orcamentos criados no sistema pela oficina. Contar a tabela inteira faria
  -- a trava acusar diferenca por causa de dado legitimo que ja estava la.
  select count(*) into esperado from _item;
  select count(*) into obtido
    from public.orcamento_item oi
    join public.orcamento o on o.id = oi.orcamento_id
   where o.import_origem is not null;
  if esperado <> obtido then
    raise exception 'ORCAMENTO_ITEM: preparados %, gravados %', esperado, obtido; end if;

  -- Financeiro: uma conta por natureza com valor > 0.
  select count(*) into esperado from _fin f
    cross join lateral (values (f.pecas), (f.mao), (f.outras)) as n(v)
    where n.v is not null and n.v > 0;
  select count(*) into obtido from public.conta_financeira where import_origem is not null;
  if esperado <> obtido then
    raise exception 'CONTA_FINANCEIRA: preparadas %, gravadas %', esperado, obtido; end if;

  -- Toda conta importada tem de ter parcela e pagamento correspondentes
  -- (de novo: so as desta importacao).
  select count(*) into esperado from public.conta_financeira where import_origem is not null;
  select count(*) into obtido
    from public.parcela_financeira p
    join public.conta_financeira cf on cf.id = p.conta_id
   where cf.import_origem is not null;
  if esperado <> obtido then
    raise exception 'PARCELA: contas %, parcelas %', esperado, obtido; end if;
  select count(*) into obtido
    from public.pagamento_financeira pg
    join public.parcela_financeira p on p.id = pg.parcela_id
    join public.conta_financeira cf on cf.id = p.conta_id
   where cf.import_origem is not null;
  if esperado <> obtido then
    raise exception 'PAGAMENTO: contas %, pagamentos %', esperado, obtido; end if;

  -- Patio: replica o predicado REAL do quadro (listarOrdensDoQuadro ->
  -- .or("status.neq.concluido,data_conclusao.gte.<corte>")). Em SQL, uma OS
  -- concluida com data_conclusao NULL avalia (false OR NULL) = NULL e fica de
  -- fora — o que so vale enquanto TODA OS importada estiver 'concluido'.
  -- A trava garante isso: nada importado pode ficar em status operacional.
  select count(*) into obtido from public.ordem_servico
   where import_origem is not null and status <> 'concluido';
  if obtido > 0 then
    raise exception 'PATIO: % OS importadas em status operacional (deveriam ser concluido)', obtido;
  end if;

  -- Do que sobra, so aparece no quadro quem tem conclusao real nos ultimos 7
  -- dias. Serviço recente aparecendo e correto; sem data, nao pode aparecer.
  select count(*) into obtido from public.ordem_servico
   where import_origem is not null and deleted_at is null and status <> 'cancelada'
     and (status <> 'concluido' or data_conclusao >= now() - interval '7 days')
     and data_conclusao is null;
  if obtido > 0 then
    raise exception 'PATIO: % OS sem data apareceriam no quadro', obtido; end if;
end $$;

-- ============================================================================
-- CONFERENCIA (aparece no resultado do SQL Editor)
-- ============================================================================
select 'cliente'          as tabela, count(*) from public.cliente          where import_origem is not null
union all select 'veiculo',          count(*) from public.veiculo          where import_origem is not null
union all select 'ordem_servico',    count(*) from public.ordem_servico    where import_origem is not null
union all select 'orcamento',        count(*) from public.orcamento        where import_origem is not null
union all select 'orcamento_item',   count(*) from public.orcamento_item oi
          where exists (select 1 from public.orcamento o where o.id = oi.orcamento_id and o.import_origem is not null)
union all select 'conta_financeira', count(*) from public.conta_financeira where import_origem is not null;

-- Troque por ROLLBACK; para simular sem gravar.
commit;
""")

sql = "\n".join(L)
dest = os.path.join(AQUI, "seed_historico.sql")
open(dest, "w", encoding="utf-8").write(sql)
print(f"-> seed_historico.sql ({len(sql)/1024:.0f} KB, {sql.count(chr(10))} linhas)")
print(f"   clientes={len(clientes)} veiculos={len(veiculos)} os={ref} orc_da_os={oref} "
      f"itens={len(itens_rows)} orc_avulso={aref} fin={len(linhas)}")
