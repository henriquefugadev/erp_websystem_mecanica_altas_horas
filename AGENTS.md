# Mecânica Altas Horas — Sistema de Gestão

Projeto do desafio **GO! JOVEM 2026** (SEBRAE-GO, Edital nº 01/2026). Entrega do relatório final: **24/08/2026**. Custo de desenvolvimento não pontua — o que pontua é **impacto operacional demonstrável** (Efetividade é o critério de maior peso).

## Contexto de negócio
- Empresa parceira: Mecânica Altas Horas, oficina mecânica em Catalão-GO.
- **Jadson** (dono) — perfil admin, acesso amplo.
- **Michele** (gerente) — usuária principal do dia a dia, tempo escasso. Toda decisão de UX deve reduzir cliques e digitação dela, não aumentar.
- Time técnico: Henrique (backend/arquitetura), Murilo (frontend).
- Gatilho real do projeto: uma ex-funcionária excluiu planilhas e históricos da oficina antes de sair. Backup automático, controle de permissões e auditoria não são "nice to have" — são o motivo do projeto existir.

## Stack (100% free-tier — decisão deliberada, ver docs/pesquisa/13 e 18)
| Camada | Tecnologia |
|---|---|
| Frontend/Backend | Next.js 15, App Router, TypeScript |
| Banco/Auth/Storage | Supabase (Postgres + Auth + Storage + Realtime) |
| UI | Tailwind CSS + shadcn/ui + lucide-react |
| Gráficos | Recharts |
| Formulários/validação | react-hook-form + Zod (mesmo schema no client e no server) |
| Automação/alertas | n8n + Telegram |
| Testes | Vitest (unitário/integração) + Playwright (E2E) |
| Deploy | Vercel |

Não trocar peças dessa stack sem justificar — cada uma foi escolhida por ter tier gratuito permanente, não trial.

## Arquitetura
- **Monólito modular**, não microsserviços (equipe pequena, prazo curto — ver docs/pesquisa/13).
- Módulos (nesta ordem de prioridade): `crm` (clientes/veículos) → `financeiro` → `patio` (kanban 3 baias) → `fornecedores` → `estoque`.
- Cada módulo separa domínio → aplicação → dados. Sem dependência circular entre módulos.
- Banco relacional único, **já modelado multi-tenant** (coluna `workshop_id` em toda tabela de negócio) mesmo operando hoje com uma oficina só — isso é o que sustenta o critério de "Potencial de continuidade" do edital.
- Isolamento entre oficinas via **Supabase Row Level Security (RLS)**, nunca só filtro na query da aplicação.
- Toda mutação em tabela sensível (`cliente`, `financeiro`, `estoque`) grava em tabela de auditoria append-only (trigger, sem UPDATE/DELETE liberado pro role da aplicação). Ver docs/pesquisa/15.

## Regras de dados (não negociáveis)
- Dinheiro sempre `NUMERIC(13,2)`. Nunca FLOAT/DOUBLE.
- Datas sempre `timestamptz` em UTC; converter para `America/Sao_Paulo` só na exibição.
- Arquivos (fotos de veículo, documentos) vão pro Supabase Storage — nunca binário no Postgres.
- Toda tabela de negócio leva `workshop_id`. Toda query leva filtro de tenant (RLS cobre isso, mas não confie só na aplicação).

## Como trabalhar aqui
- Antes de implementar um módulo, leia o documento correspondente em `docs/pesquisa/`. As regras de negócio, entidades e critérios de aceite já foram levantados lá — não redescubra do zero.
- Para decisões de arquitetura (schema, RLS, particionamento de módulos): use `/model opusplan`. Para código do dia a dia: `sonnet` (padrão) é suficiente.
- Mudança em mais de um arquivo → mostre um plano antes de implementar (plan mode).
- Toda função de cálculo financeiro ou baixa de estoque precisa de teste antes de ser considerada pronta.
- Commits em **Conventional Commits, em pt-br**: `feat: adiciona cadastro de clientes`, `fix: corrige cálculo de troco`, `test: cobre baixa de estoque`.

## Comandos
```bash
npm run dev      # ambiente local
npm run test     # Vitest
npm run test:e2e # Playwright
npm run lint     # ESLint + typecheck
```

Sempre que for rodar comandos de shell (git, npm, cargo, pytest, etc.), 
use o prefixo `rtk` (ex: rtk git status, rtk npm test) para economizar tokens, 
conforme as instruções em RTK.md.

## Design
Sidebar preto `#16161A`, amarelo de ação `#F5B400`, vermelho `#D62828` **reservado só para alertas reais** (não decoração). Título: Oswald. Corpo: Inter. Evitar preto/amarelo em excesso — Michele usa isso o dia inteiro, tem que ser legível, não chamativo.

## Fora de escopo do MVP (não implementar sem discutir antes)
- Motor próprio de emissão fiscal (NF-e/NFS-e) — a oficina já emite por fora com certificado A1 válido. Documentar como integração futura (ex.: provedor terceiro), não construir motor tributário próprio.
- Folha de pagamento, contabilidade formal (DRE/Balanço), conciliação bancária automática.
- Multiempresa "de verdade" (várias oficinas pagantes) — o schema já suporta, mas a feature de onboarding de novos tenants não é deste ciclo.
