<div align="center">

# 🚗 Mecânica Altas Horas
### Sistema de Gestão para Oficinas Mecânicas

Sistema web completo de gestão operacional e financeira para oficinas mecânicas — do entrada do veículo à entrega, com controle de estoque, orçamentos, financeiro multiempresa e auditoria total.

Desenvolvido para o desafio **GO! JOVEM 2026** (SEBRAE-GO, Edital nº 01/2026) em parceria com a Mecânica Altas Horas (Catalão-GO).

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-Postgres-green?logo=supabase)
![Tailwind](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss)
![Vitest](https://img.shields.io/badge/Testes-Vitest-6E9F18?logo=vitest)
![License](https://img.shields.io/badge/License-MIT-yellow)

</div>

---

> **O problema real:** uma ex-funcionária excluiu planilhas e históricos inteiros da oficina antes de sair. Backup automático, controle de permissões e trilha de auditoria não eram "bom ter" — eram o motivo do projeto existir. Este sistema substitui planilhas frágeis por uma plataforma web segura, multi-tenant e auditável.

## 📸 Galeria

| Dashboard Financeiro | Pátio (Kanban) |
|---|---|
|  | <img width="1914" height="910" alt="image" src="https://github.com/user-attachments/assets/7eeedeff-fcd1-4eb3-8d80-365df62b8d52" />
 |

| Cadastro de Clientes | Contas |
|---|---|
| | ![Orçamento](docs/screenshots/orcamento.png) | <img width="1917" height="905" alt="image" src="https://github.com/user-attachments/assets/e96cb262-5a85-427d-859e-859aa21ed4e3" />


| Funcionários  |
|---|---|
| <img width="1426" height="590" alt="image" src="https://github.com/user-attachments/assets/c96af02d-65b6-4246-8949-5880d3eb9706" />


---

## ✨ Principais Funcionalidades

### 🏠 CRM — Clientes & Veículos
- Cadastro de clientes PF/PJ com documento, endereço completo e consentimento de comunicação
- Veículos vinculados a clientes com placa, marca, modelo e ano
- Busca tolerante a acento (ex: "Joao" encontra "João")
- Histórico de ordens de serviço por veículo
- Fotos do veículo armazenadas no Supabase Storage

### 🔧 Pátio — Kanban de Ordens de Serviço
- Quadro kanban com 5 colunas: Aguardando → Confirmação → Em Execução → Parado → Concluído
- Arrastar-e-soltar para mover OS entre status, com regras de transição válidas
- Alocação automática no galpão menos ocupado
- Diagnóstico e cotação de peças direto no card
- Sinais de atenção (tempo parado, lotação de galpões)
- Arquivamento de OS concluídas com desarquivamento

### 📋 Orçamentos
- Criação de orçamentos com itens de peça e serviço
- Cotação de peças com markup configurável por oficina
- Aprovação total ou parcial pelo cliente
- Geração automática de pedidos de compra das peças aprovadas
- Cálculo de margem por item (visão interna)
- PDF do orçamento com QR Code PIX para pagamento
- Status: rascunho → enviado → aprovado/reprovado → aprovado parcial

### 💰 Financeiro
- Dashboard com KPIs: recebido/pago de hoje, semana e mês
- Gráfico de fluxo de caixa (Recharts)
- Painel de inadimplência
- Faturamento por categoria
- Contas a pagar e receber com parcelamento
- Baixa e estorno de pagamentos com controle de centavos
- Categorias de receita e despesa personalizáveis
- Integração automática: conclusão de OS gera contas a receber por categoria

### 📦 Estoque
- Cadastro de peças com estoque atual e mínimo
- Sinais de nível (ok / baixo / zerado)
- Movimentações: entrada por compra, saída por consumo, perda e ajuste
- Custo médio ponderado
- Consumo automático ao usar peça em OS

### 🛒 Compras & Fornecedores
- Cadastro de fornecedores
- Cotações de peças com múltiplos fornecedores
- Pedidos de compra gerados a partir de orçamentos aprovados
- Recebimento de pedido → entrada automática no estoque

### 👥 Funcionários
- Cadastro de funcionários com ativação/inativação
- Atribuição em ordens de serviço

### ⚙️ Configurações (admin)
- Dados da oficina e logo
- Condições de pagamento padrão e markup de peças
- Tipos de item de orçamento e catálogo de serviços
- Ocultar/mostrar módulos da sidebar por oficina
- Reordenar grupos da navegação arrastando

### 🔒 Segurança & Auditoria
- **Multi-tenant nativo**: toda tabela leva `workshop_id`, isolamento via Row Level Security (RLS) no Postgres — nunca só filtro na aplicação
- **Trilha de auditoria append-only**: mutações em tabelas sensíveis (cliente, financeiro, estoque) gravam em tabela de auditoria via trigger, sem UPDATE/DELETE liberado para o role da aplicação
- **Controle de permissões por papel**: `admin` (Jadson) e `gerente` (Michele), com bloqueio de rotas e ações no banco
- **Soft delete**: registros não são apagados — recebem `deleted_at`, preservando histórico

---

## 🏗️ Arquitetura

Monólito modular em Next.js 15 (App Router), com separação clara de camadas:

```
src/
├── app/                      # Rotas (App Router)
│   ├── (auth)/               # Login, cadastro, recuperação de senha
│   └── (app)/               # App autenticado
│       ├── clientes/         # CRM
│       ├── orcamentos/       # Orçamentos
│       ├── patio/            # Kanban de OS
│       ├── financeiro/       # Dashboard + contas + categorias
│       ├── estoque/          # Peças e movimentações
│       ├── compras/          # Pedidos de compra
│       ├── cotacoes/         # Cotações de peças
│       ├── fornecedores/     # Fornecedores
│       ├── funcionarios/    # Funcionários
│       └── configuracoes/   # Configurações (admin)
├── modules/                  # Módulos de domínio (DDD)
│   ├── crm/                  # domain → application → data
│   ├── orcamento/
│   ├── patio/
│   ├── financeiro/
│   ├── estoque/
│   ├── fornecedores/
│   ├── funcionarios/
│   ├── servicos/
│   ├── workshop/
│   └── auth/
├── components/               # UI (shadcn/ui + componentes de domínio)
└── lib/                      # Supabase client, formatação, paginação
```

**Cada módulo segue a mesma estrutura:**
- `domain/` — regras de negócio puras, testáveis sem banco
- `application/` — server actions (mutations) e orquestração
- `data/` — repositórios (queries e persistência)

### Decisões técnicas

| Decisão | Por quê |
|---|---|
| Monólito modular, não microsserviços | Equipe pequena, prazo curto — complexidade de distribuição não se paga |
| Multi-tenant com RLS desde o dia 1 | Sustenta o critério de "Potencial de continuidade" do edital; uma oficina hoje, várias amanhã |
| Auditoria via trigger append-only | O papel da aplicação não pode apagar a trilha — nem um bug nem um insider apaga o histórico |
| `NUMERIC(13,2)` para dinheiro | Nunca FLOAT/DOUBLE — erros de arredondamento em centavos |
| `timestamptz` em UTC, conversão só na exibição | Dados consistentes em fuso, exibição em `America/Sao_Paulo` |
| Zod nos schemas | Mesma validação no client (form) e no server (action) — fonte única |
| Stack 100% free-tier | Cada peça escolhida por ter tier gratuito permanente, não trial |

### Stack

| Camada | Tecnologia |
|---|---|
| Frontend/Backend | Next.js 15, App Router, TypeScript, React 19 |
| Banco/Auth/Storage | Supabase (Postgres + Auth + Storage + Realtime + RLS) |
| UI | Tailwind CSS 4 + shadcn/ui + lucide-react |
| Gráficos | Recharts |
| Formulários/validação | react-hook-form + Zod |
| PDF | @react-pdf/renderer (orçamentos com QR Code PIX) |
| Testes | Vitest (unitário/integração) + Playwright (E2E) |
| Deploy | Vercel |

---

## 🚀 Como Rodar

### Pré-requisitos
- Node.js 18+
- Uma conta no [Supabase](https://supabase.com) (free tier)

### Passo a passo

1. **Clone o repositório**
   ```bash
   git clone https://github.com/henriquefugadev/erp_websystem_mecanica_altas_horas
   cd mecanica-altas-horas
   ```

2. **Instale as dependências**
   ```bash
   npm install
   ```

3. **Configure as variáveis de ambiente**
   ```bash
   cp .env.example .env.local
   ```
   Edite `.env.local` com as chaves do seu projeto Supabase (em *Project Settings → API*):

   | Variável | Descrição |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase (ex.: `https://xxxx.supabase.co`) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave pública (anon). Segura no browser — o isolamento vem das RLS policies |

4. **Aplique as migrações no Supabase**
   As migrações versionadas estão em [`supabase/migrations`](supabase/migrations), aplicadas em ordem (`0001_…`, `0002_…`, …). Rode-as no SQL Editor do Supabase ou com a CLI:
   ```bash
   supabase db push
   ```

5. **Rode o projeto**
   ```bash
   npm run dev
   ```
   Abra [http://localhost:3000](http://localhost:3000)

### Comandos disponíveis

```bash
npm run dev       # Ambiente local
npm run test      # Vitest (unitário + integração com Postgres embarcado)
npm run test:e2e  # Playwright (E2E)
npm run lint      # ESLint + typecheck (tsc --noEmit)
npm run build     # Build de produção
```

---

## 📖 Tutorial de Uso

### 1. Primeiro acesso
Após aplicar as migrações, crie sua conta na tela de cadastro. O primeiro usuário recebe papel de **admin** com acesso total ao sistema.

### 2. Configurando a oficina
Em **Configurações** (ícone de engrenagem, só visível para admin):
- Defina o nome da oficina e faça upload do logo
- Configure as condições de pagamento padrão
- Ajuste o markup percentual aplicado sobre peças
- Cadastre tipos de item de orçamento e serviços do catálogo
- Oculte módulos que a oficina não usa (ex.: estoque)

### 3. Cadastrando clientes e veículos
Em **Clientes** → **Novo cliente**:
- Informe documento, contato e endereço
- Vincule veículos (placa, marca, modelo, ano)
- Adicione fotos do veículo (salvas no Supabase Storage)

### 4. Criando um orçamento
Em **Orçamentos** → **Novo orçamento**:
- Selecione cliente e veículo
- Adicione itens (peças e serviços) com quantidade e preço
- Cote peças se necessário (markup automático aplicado)
- Envie ao cliente — ele aprova total ou parcialmente
- Gere o PDF com QR Code PIX para pagamento

### 5. Fluxo do pátio
Em **Pátio** (kanban):
- Crie uma nova OS a partir de um orçamento ou diretamente
- Arraste cards entre colunas conforme o andamento
- O sistema sugere o galpão menos ocupado para alocação
- Registre diagnóstico e cotação direto no card
- Ao concluir, as contas a receber são geradas automaticamente

### 6. Financeiro
Em **Dashboard Financeiro**:
- Acompanhe receitas e despesas de hoje, semana e mês
- Veja o gráfico de fluxo de caixa e inadimplência
- Em **Contas**, registre pagamentos e estornos com parcelamento
- Em **Categorias**, organize receitas e despesas

### 7. Estoque e compras
- Cadastre peças com estoque mínimo em **Estoque**
- Receba alertas de peças abaixo do mínimo
- Gere pedidos de compra a partir de orçamentos aprovados
- Ao receber pedido, o estoque é atualizado automaticamente

---

## 🗄️ Modelo de Dados

27 migrações versionadas cobrindo:
- `0001` — Fundação multi-tenant + CRM (cliente/veículo)
- `0002` — Financeiro (contas, parcelas, baixas, auditoria)
- `0005` — Pátio (ordens de serviço, kanban)
- `0007` — Fornecedores e compras
- `0008` — Estoque (peças, movimentações, custo médio)
- `0011` — Orçamentos
- `0018` — PIX e PDF de orçamento
- `0021` — Garantia de serviço
- `0025` — Arquivamento de OS
- ...e parametrizações, índices, backfills

Ver todas em [`supabase/migrations/`](supabase/migrations).

---

## 🧪 Testes

Toda função de cálculo financeiro ou baixa de estoque possui testes unitários antes de ser considerada pronta. Os testes rodam com Postgres embarcado ([PGlite](https://pglite.dev/)) para integração real sem instância externa.

```bash
npm run test      # unitário + integração
npm run test:e2e  # fluxos completos no navegador (Playwright)
```

---

## 🚢 Deploy

### Vercel (recomendado)
1. Importe o repositório em [vercel.com/new](https://vercel.com/new)
2. Em **Settings → Environment Variables**, adicione `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Production e Preview)
3. Deploy — a cada push na `main`, a Vercel reconstrói sozinha

### Netlify
1. Importe o repositório (Next.js Runtime é detectado automaticamente)
2. Adicione as variáveis de ambiente
3. Deploy

> As chaves do Supabase vão **no painel da plataforma**, nunca no repositório (`.env.local` está no `.gitignore`).

---

## 🎨 Design

Interface pensada para uso intensivo no dia a dia — legível, não chamativo.

| Elemento | Cor | Uso |
|---|---|---|
| Sidebar | `#16161A` (preto) | Navegação |
| Ação | `#F5B400` (amarelo) | Botões primários |
| Alerta | `#D62828` (vermelho) | **Apenas alertas reais**, nunca decoração |

**Tipografia:** Oswald (títulos) · Inter (corpo)

---

## 📁 Estrutura do Projeto

```
.
├── src/
│   ├── app/              # Rotas Next.js (App Router)
│   ├── modules/          # Módulos de domínio (domain → application → data)
│   ├── components/       # UI e componentes de domínio
│   └── lib/             # Supabase, formatação, paginação, utils
├── supabase/
│   └── migrations/      # 27 migrações SQL versionadas
├── tests/                # Testes de integração (Vitest)
├── docs/                 # Documentação de pesquisa e decisions
└── public/               # Assets estáticos
```

---

## 👤 Autor

Desenvolvido por **Henrique Fuga Gomes** — responsável por arquitetura, backend, banco de dados e toda a modelagem multi-tenant com RLS e auditoria.

- 📧 (16) 99605-1235
- 💼 [LinkedIn](https://www.linkedin.com/)
- 🐙 [GitHub](https://github.com/henriquefuga)

Colaboração de **Murilo de Santana** no frontend.

---

## 📄 Licença

Distribuído sob licença MIT. Veja [`LICENSE`](LICENSE) para detalhes.

---

<div align="center">

**Projeto desenvolvido para o desafio GO! JOVEM 2026 — SEBRAE-GO**

Entrega do relatório final: 24/08/2026

</div>
