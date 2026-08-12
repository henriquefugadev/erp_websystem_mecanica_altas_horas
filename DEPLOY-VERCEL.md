# Subir o sistema na Vercel — passo a passo

Guia completo para publicar a **Mecânica Altas Horas** em produção.
Siga na ordem. Cada etapa tem um "como conferir" — não pule.

> **Tempo estimado:** 40–60 min na primeira vez (a maior parte é rodar migração e
> conferir). Os deploys seguintes são automáticos: `git push` e pronto.

---

## Antes de tudo: o que pode dar errado

Estes são os erros que realmente acontecem neste projeto, em ordem de gravidade:

| # | Erro | Consequência |
|---|---|---|
| 1 | Commitar `seed_historico.sql` / `historico.json` | **Dados reais de clientes da oficina vão pro GitHub** (nomes, telefones, placas) |
| 2 | Esquecer de rodar as migrações no Supabase | Telas quebram com "column does not exist" |
| 3 | Não configurar as **Redirect URLs** no Supabase | "Esqueci a senha" manda link que não funciona |
| 4 | Faltar variável de ambiente na Vercel | Build passa, app quebra em branco |
| 5 | Rodar `seed_historico.sql` duas vezes | Histórico duplicado no banco |

O passo 0 cuida do #1. Não pule o passo 0.

---

## Passo 0 — Proteger os dados dos clientes (FAÇA PRIMEIRO)

Existem arquivos na pasta do projeto com **dados reais** extraídos do HD antigo da
oficina:

```
supabase/seed_historico.sql          ~223 KB  ← nomes, telefones, placas reais
supabase/seed_demo_michely.sql        ~17 KB
scripts/historico/historico.json     ~474 KB  ← idem
scripts/demo/                                  ← gerador de dados
```

Hoje eles estão **fora do Git** (untracked). Se você der `git add .` sem cuidado,
eles entram no commit e sobem pro GitHub.

**Faça isto agora**, na raiz do projeto:

```bash
printf '\n# dados reais da oficina - NUNCA versionar (LGPD)\nsupabase/seed_historico.sql\nsupabase/seed_demo_michely.sql\nscripts/historico/historico.json\nscripts/demo/\n' >> .gitignore
```

Confira que funcionou — os arquivos devem sumir da lista:

```bash
git status --short --untracked-files=all
```

> **Se o repositório do GitHub for público**, confira também se esses arquivos já
> não foram enviados em algum commit anterior:
> ```bash
> git log --all --oneline -- supabase/seed_historico.sql scripts/historico/
> ```
> Se aparecer alguma linha, os dados **já estão no histórico do GitHub** e apagar
> o arquivo agora não resolve — é preciso reescrever o histórico ou tornar o
> repositório privado. Fale comigo antes de fazer qualquer coisa nesse caso.

---

## Passo 1 — Deixar o `.env.example` visível no repositório

O `.gitignore` tem a regra `.env*`, que ignora **também** o `.env.example`. Mas o
`README.md` manda o próximo desenvolvedor rodar `cp .env.example .env.local` — e o
arquivo não está lá.

Abra o `.gitignore` e, logo abaixo da linha `.env*`, adicione:

```
!.env.example
```

Depois:

```bash
git add -f .env.example && git status --short
```

O `.env.example` deve aparecer como `A` (added). O `.env.local` **não** pode
aparecer — ele tem as suas chaves reais.

---

## Passo 2 — Rodar as migrações que faltam no Supabase

As migrações ficam em `supabase/migrations/`, numeradas. Elas rodam **em ordem** e
**uma vez cada**.

### 2.1 — Descobrir o que já rodou

No painel do Supabase → **SQL Editor** → cole e rode:

```sql
select
  to_regclass('public.servico_catalogo')          is not null as "0023_rodou",
  to_regclass('public.ordem_servico')             is not null as "base_ok",
  exists (select 1 from information_schema.columns
          where table_name='ordem_servico' and column_name='garantia_ate')      as "0021_rodou",
  exists (select 1 from information_schema.columns
          where table_name='ordem_servico' and column_name='titulo')            as "0022_rodou",
  exists (select 1 from information_schema.columns
          where table_name='ordem_servico' and column_name='arquivada_em')      as "0025_rodou",
  exists (select 1 from information_schema.columns
          where table_name='cliente' and column_name='import_chave')            as "0024_rodou",
  to_regprocedure('public.receber_parcelas_da_os(uuid,date,text,text,uuid)')
                                                  is not null as "0026_rodou";
```

Cada coluna responde `true` (já rodou) ou `false` (falta rodar).

### 2.2 — Rodar as que faltam, na ordem numérica

Para cada `false`, abra o arquivo correspondente em `supabase/migrations/`, copie
o conteúdo **inteiro**, cole no SQL Editor e rode. **Uma migração por vez**, do
número menor para o maior:

```
0021_garantia.sql
0022_os_titulo.sql
0023_parametrizacoes_patio.sql
0024_historico_import.sql
0025_os_arquivamento.sql
0026_receber_parcelas_os.sql
0027_indices_historico_parcelas.sql
```

> ⚠️ **A 0026 não é opcional.** O "Receber pagamento" do card concluído chama a
> função `receber_parcelas_da_os` criada nela. Sem rodar, o botão devolve erro.
>
> A 0027 só cria índices: não roda risco de quebrar nada, e é o que segura a
> velocidade do histórico do cliente agora que a base tem o histórico antigo.

**Situação verificada em 12/08/2026** no banco de vocês: 0021, 0022, 0023 e
0025 **já rodaram**. Faltam a **0026** e a **0027**. (A 0024 aparece como não
aplicada na checagem acima, mas o histórico já está importado — confirme com o
SQL do 2.1 antes de rodá-la, para não duplicar.)

> ⚠️ **Não pule a ordem.** A 0023 depende de tabelas criadas na 0017, e a 0024
> depende da 0023. Rodar fora de ordem dá erro de coluna inexistente.

Depois de rodar tudo, rode o SQL de verificação do 2.1 de novo. Todas as colunas
devem estar `true`.

### 2.3 — (Opcional) Importar o histórico da oficina

**Só se ainda não importou.** Este passo carrega o histórico do HD antigo.

O arquivo tem ~223 KB e o SQL Editor do Supabase quebra scripts desse tamanho.
Use `psql`:

```bash
psql "postgresql://postgres.SEU_PROJETO:SUA_SENHA@aws-0-sa-east-1.pooler.supabase.com:5432/postgres" -f supabase/seed_historico.sql
```

A connection string está em **Project Settings → Database → Connection string →
URI**.

> **Rodar duas vezes duplica o histórico.** Antes de rodar, confira:
> ```sql
> select count(*) from cliente where import_chave is not null;
> ```
> Se vier maior que zero, já foi importado — **não rode de novo**.
> Se precisar refazer, rode antes o `scripts/historico/desfazer-historico.sql`.

---

## Passo 3 — Configurar a autenticação no Supabase

Este é o passo que todo mundo esquece e só descobre quando a Michele clica em
"Esqueci a senha" e o link não funciona.

No painel do Supabase → **Authentication → URL Configuration**:

**Site URL:**
```
https://SEU-PROJETO.vercel.app
```

**Redirect URLs** (clique em *Add URL* para cada uma):
```
https://SEU-PROJETO.vercel.app/**
http://localhost:3000/**
```

O `/**` no fim é obrigatório — o app redireciona para
`/auth/callback?next=/redefinir-senha`, e sem o curinga o Supabase recusa.

> Você ainda não sabe a URL da Vercel neste momento. Tudo bem: faça o passo 4
> primeiro, pegue a URL real, e **volte aqui**. Marque isso, é o erro nº 3 da
> tabela lá em cima.

---

## Passo 4 — Publicar na Vercel

### 4.1 — Commitar e enviar

```bash
git add -A && git status --short
```

**Olhe a lista antes de commitar.** Não pode aparecer:
- `.env.local`
- `supabase/seed_historico.sql`
- `scripts/historico/historico.json`

Se aparecer algum, volte ao passo 0.

```bash
git commit -m "chore: prepara o sistema para o deploy de producao"
git push origin main
```

### 4.2 — Importar na Vercel

1. Acesse [vercel.com/new](https://vercel.com/new) e entre com o GitHub.
2. **Import** no repositório `web-system-mecanica-altas-horas`.
3. **Framework Preset:** Next.js (detectado sozinho — não mexa).
4. **Root Directory:** ⚠️ se o repositório tiver a pasta
   `web-system-mecanica-altas-horas/` dentro dele, clique em *Edit* e aponte pra
   ela. Se o `package.json` estiver na raiz, deixe como está.
5. **Build Command / Output Directory:** não mexa.

### 4.3 — Variáveis de ambiente

Ainda na tela de import, abra **Environment Variables** e adicione as duas:

| Name | Value | Onde pegar |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGci...` (chave longa) | Supabase → Project Settings → API → anon public |

Marque as três caixas: **Production**, **Preview** e **Development**.

> São exatamente os mesmos valores do seu `.env.local`. Confira com:
> ```bash
> cat .env.local
> ```
> Copie e cole — não digite à mão, a chave anon tem centenas de caracteres.

> A chave `anon` **pode** ficar exposta no navegador — é assim que o Supabase
> funciona. O isolamento dos dados vem das políticas RLS no banco, não do sigilo
> da chave.
>
> ⚠️ **Não configure `SUPABASE_SERVICE_ROLE_KEY` na Vercel.** Ela existe no seu
> `.env.local` só porque o script local `scripts/upload-historico.mjs` precisa
> dela para subir as fotos do histórico. Nenhuma tela do sistema usa — e essa
> chave **ignora todas as RLS**, então na Vercel ela só acrescentaria risco.

### 4.4 — Deploy

Clique em **Deploy** e espere (~2 min). Se der erro no build, veja
[Se der errado](#se-der-errado) no fim.

Deu certo? Copie a URL (`https://algo.vercel.app`) e **volte ao passo 3** para
preencher Site URL e Redirect URLs.

---

## Passo 5 — Testar antes de entregar

Abra a URL da Vercel e faça este roteiro, na ordem. Marque cada um:

- [ ] **Login** — entra com o e-mail e senha do admin
- [ ] **Pátio** — o quadro carrega com as colunas e os cards
- [ ] **Ação no quadro** — clique em "Iniciar" numa OS. O card **muda de coluna
      sozinho**, sem apertar F5
- [ ] **Galpões** — as bolinhas de lotação aparecem acima do quadro
- [ ] **Entrada de veículo** — busca cliente por placa e registra
- [ ] **Configurações** — abre e mostra os cards de galpões, prazos e serviços
- [ ] **Créditos** — no fim das Configurações aparece "Desenvolvido por"
- [ ] **Financeiro** — o gráfico de fluxo de caixa desenha
- [ ] **PDF do orçamento** — abre um orçamento e clica em gerar PDF
- [ ] **Esqueci a senha** — pede o link, o e-mail chega, e o link **abre a tela de
      nova senha** (não a de erro)
- [ ] **Celular** — abra a URL no seu telefone e confira o Pátio e a Entrada

O terceiro item é o mais importante: é o único que não dá pra verificar sem estar
logado no navegador.

---

## Se der errado

### Build falha na Vercel

Abra o log completo (clique no deploy → *Building*). Os casos comuns:

| Mensagem | Causa | Solução |
|---|---|---|
| `Module not found` | Root Directory errado | Settings → General → Root Directory |
| `supabaseUrl is required` | Faltou variável | Settings → Environment Variables, e **Redeploy** |
| `Type error:` | Erro de TypeScript | Rode `npm run lint` local e corrija |

Depois de mexer em variável, é preciso **Redeploy** (Deployments → ⋯ →
Redeploy). A Vercel não reconstrói sozinha por mudança de env.

### App abre em branco / erro 500

1. Vercel → seu projeto → **Logs** (runtime), veja a mensagem real.
2. Se for `column ... does not exist` → falta rodar migração (passo 2).
3. Se for `Invalid API key` → a `NEXT_PUBLIC_SUPABASE_ANON_KEY` foi colada
   incompleta. Apague e cole de novo.

### Link de "esqueci a senha" cai em `/login?erro=link`

A Redirect URL não está cadastrada, ou está sem o `/**`. Volte ao passo 3.
Depois de alterar, peça um link **novo** — o antigo continua inválido.

### O quadro do Pátio não atualiza sozinho ao clicar

Sintoma: você clica em "Iniciar", aparece o aviso verde, mas o card só muda de
lugar depois do F5.

Causa: o `router.refresh()` foi removido do
`src/app/(app)/patio/kanban-board.tsx` porque o `revalidatePath("/patio")` do
servidor já devolve a tela atualizada. Se na prática não estiver acontecendo, o
conserto é devolver o refresh dentro da função `executar`:

```ts
async function executar<T>(acao, aoDarCerto) {
  const resultado = await acao;
  if (!resultado.ok) { toast.error(resultado.erro); return; }
  toast.success(...);
  router.refresh();   // <- devolver esta linha
}
```

### Precisa criar um login novo para alguém

**Não existe tela para isso ainda.** A tela de "Criar cadastro" só orienta a
pedir ao administrador, e o cadastro em *Funcionários* cria o registro do
funcionário, **não** o acesso ao sistema.

Para criar um login de verdade:

1. Supabase → **Authentication → Users → Add user** (e-mail + senha).
2. Copie o **UUID** do usuário criado.
3. SQL Editor:

```sql
-- troque os dois UUIDs e os dados
insert into public.usuario (id, nome, email)
values ('UUID-DO-USUARIO', 'Nome da Pessoa', 'email@dominio.com');

insert into public.usuario_workshop (usuario_id, workshop_id, papel)
values ('UUID-DO-USUARIO', (select id from public.workshop limit 1), 'gerente');
```

`papel` aceita `admin` (Jadson — vê Configurações) ou `gerente` (Michele).

> **Sem o `usuario_workshop`, a pessoa consegue logar mas fica presa num loop de
> redirecionamento** — o middleware deixa passar (o usuário existe no Auth) e o
> layout manda de volta pro login (não achou a oficina). Sempre rode os dois
> inserts.

---

## Depois do primeiro deploy

- **Todo `git push origin main` publica automaticamente.** Não precisa mexer na
  Vercel de novo.
- **Migração nova não sobe sozinha.** Sempre que criar um arquivo em
  `supabase/migrations/`, rode o SQL no painel do Supabase **antes** de dar push
  no código que usa as colunas novas.
- **Antes de qualquer push**, rode local:
  ```bash
  npm run lint && npm test && npm run build
  ```
  Se os três passarem, o build da Vercel também passa.
- **Backup do banco:** Supabase → Database → Backups. No plano free o backup é
  diário e retido por 7 dias. Considerando que o projeto nasceu de uma perda de
  dados, vale exportar um dump manual antes de qualquer operação grande:
  ```bash
  pg_dump "SUA_CONNECTION_STRING" -Fc -f backup-$(date +%Y%m%d).dump
  ```
