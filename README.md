# Mecânica Altas Horas — Sistema de Gestão

Sistema de gestão para oficina mecânica (desafio **GO! JOVEM 2026**, SEBRAE-GO).
Cobre o fluxo real da oficina: entrada do veículo → diagnóstico → cotação de
peças → orçamento → aprovação do cliente → compra → execução → entrega.

**Stack:** Next.js 15 (App Router, TypeScript) · Supabase (Postgres + Auth +
Storage + RLS) · Tailwind + shadcn/ui · Vitest.

## Rodando localmente

```bash
npm install
cp .env.example .env.local   # e preencha as chaves do Supabase
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

Outros comandos:

```bash
npm run test   # Vitest (unit + integração com Postgres embarcado)
npm run lint   # ESLint + typecheck (tsc)
```

## Variáveis de ambiente

Necessárias para rodar e para o deploy (pegue em *Project Settings → API* no
painel do Supabase):

| Variável | Onde usar | Descrição |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | build + runtime | URL do projeto Supabase (ex.: `https://xxxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | build + runtime | Chave pública (anon). Segura no browser — o isolamento vem das RLS policies. |

> `SUPABASE_SERVICE_ROLE_KEY` ainda **não** é usada pelo código. Só configure se
> algum fluxo administrativo server-only passar a precisar. Nunca expor no browser.

## Banco de dados (Supabase)

As migrações versionadas estão em [`supabase/migrations`](supabase/migrations),
aplicadas em ordem (`0001_…`, `0002_…`, …). Para um projeto Supabase novo, rode-as
na ordem pelo SQL Editor ou com a Supabase CLI (`supabase db push`).

## Deploy

O app é um Next.js padrão — build `next build`, sem configuração especial.

### Vercel (recomendado)
1. Importe o repositório em [vercel.com/new](https://vercel.com/new). O framework
   é detectado automaticamente (build `next build`, sem ajustes).
2. Em **Settings → Environment Variables**, adicione as duas variáveis da tabela
   acima (Production e Preview).
3. Deploy. A cada push na branch `main`, a Vercel reconstrói sozinha.

### Netlify
1. **Add new site → Import from Git** e selecione o repositório. O Next.js Runtime
   é detectado automaticamente (build `npm run build`).
2. Em **Site configuration → Environment variables**, adicione as duas variáveis.
3. Deploy.

> As chaves do Supabase vão **no painel da plataforma**, nunca no repositório
> (`.env.local` está no `.gitignore`).
