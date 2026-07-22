# Relatório Técnico — ZapBusiness

## 1. Objetivo

Documentar o estado atual do repositório Feed-Agent / produto **ZapBusiness**, mapear arquitetura, funcionalidades, alterações recentes de outros desenvolvedores, riscos e preparar a branch privada **Eduardo** para desenvolvimento futuro — sem implementar features, sem deploy e sem alterar branches alheias.

## 2. Data e contexto da auditoria

| Campo | Valor |
|-------|--------|
| Data | 22/07/2026 |
| Executor | Auditoria automatizada assistida (Cursor) sob regras de segurança do prompt |
| Branch auditada | `Eduardo` @ `d6ad329` |
| Remoto principal | `origin` → `https://github.com/LCM-ENTERPRISE-INC/Feed-Agent.git` |
| Remoto upstream | `upstream` → `https://github.com/LuckArkman/Feed-Agent.git` |
| Escopo | Código local + histórico Git; sem deploy; sem alteração de DB remoto |

## 3. Estado do repositório

| Verificação | Resultado |
|-------------|-----------|
| `git status` | Working tree **limpa** |
| Branch atual | `Eduardo` |
| Tracking | `origin/Eduardo` (up to date) |
| Stashes | Nenhum |
| Tags | Nenhuma tag encontrada |
| Alterações não commitadas | Nenhuma (antes da criação desta documentação) |
| Branches locais | `Eduardo`, `Front`, `chat-panel`, `main` |
| Branches remotas origin | `main`, `Front`, `chat-panel`, `Eduardo`, `aquecimento-de-contas` (nova no fetch) |
| `origin/HEAD` | `origin/main` |

## 4. Estratégia de branches

```text
main (oficial / default)
  ↑ merges via PR (#1 Front, #2/#3 chat-panel)
Front          → branding ZapBusiness + UI + fix import CSV (8c89191)
chat-panel     → chat + SSL/Docker/certbot
Eduardo        → tip idêntico a chat-panel (d6ad329)
aquecimento-de-contas → branch remota (não inspecionada em profundidade nesta auditoria)
```

**Branch base oficial identificada:** `main` (apontada por `origin/HEAD`).

**Branch de infraestrutura recente / produção SSL:** `chat-panel` / `Eduardo`.

## 5. Branch privada Eduardo

- **Já existia** local e remotamente (`origin/Eduardo`).
- **Não foi recriada** (conforme regras).
- Tip: `d6ad329` — autor Mauricio da Paixão Costa — *fix: remove certbot github dependencies and update ports*.
- Equivalente a `chat-panel` no tip.
- Documentação de regras: `docs/BRANCH-EDUARDO.md`.
- **Push não realizado.**

## 6. Estrutura do projeto

Monorepo com frontend e backend separados + compose na raiz.

```text
/
├── back-end/          # API Express + Prisma + Baileys + filas
├── front-end/         # React + Vite (ZapBusiness UI)
├── docs/              # Documentação desta auditoria
├── docker-compose.yml
├── init-letsencrypt.sh
├── RELATORIO-0.1.*.md
├── backend_architecture_audit.md
├── walkthrough.md
├── whatsapp_warmup_plan.md
└── (planilha financeira não relacionada ao produto)
```

Não listados: `node_modules`, `dist`, caches.

## 7. Arquitetura atual

```text
[Browser / PWA shell]
        │
        ▼
[nginx frontend] ──/api──► [Express backend :3000]
        │                        │
        │                        ├── PostgreSQL (Prisma: User, Contact, Draft, WA Instance)
        │                        ├── MongoDB (FeedHistory, ChatMessage)
        │                        ├── Redis + BullMQ (OCR queue, Broadcast queue)
        │                        ├── Baileys sessions (disco)
        │                        └── Llama local (node-llama-cpp) + Tesseract OCR
        ▼
   static SPA (ZapBusiness)
```

Padrão: API REST + SSE (QR WhatsApp, jobs OCR, mensagens chat). Autenticação JWT. Isolamento de dados por `userId` nos serviços principais.

## 8. Tecnologias e dependências

### Frontend (`front-end` 0.0.0)

| Tecnologia | Versão (package) |
|------------|------------------|
| React / React DOM | ^19.2.6 |
| Vite | ^8.0.12 |
| TypeScript | ~6.0.2 |
| react-router-dom | ^7.15.0 |
| axios | ^1.16.0 |
| zustand | ^5.0.13 |
| @tanstack/react-query | ^5.100.10 (instalado; uso limitado) |
| recharts | ^3.8.1 |
| papaparse | ^5.5.3 |
| vitest / Testing Library | ^4.1.10 / ^16.x |
| Node imagem Docker frontend | node:22-alpine |

### Backend (`back-end` 1.0.0)

| Tecnologia | Versão |
|------------|--------|
| Express | ^5.2.1 |
| Prisma / @prisma/client | ^6.19.3 |
| mongoose | ^9.6.1 |
| Baileys | ^7.0.0-rc.9 |
| bullmq / ioredis | ^5.x |
| jsonwebtoken / bcrypt | ^9 / ^6 |
| node-llama-cpp | ^3.19.0 |
| tesseract.js / sharp | OCR |
| Jest | ^30.3.0 |
| Node imagem Docker backend | node:20-bookworm-slim |

### Infra

Docker Compose 3.8, nginx, certbot, PostgreSQL 15, MongoDB 6, Redis.

## 9. Serviços e aplicações

| Serviço compose | Função | Portas host (Eduardo) |
|-----------------|--------|------------------------|
| frontend | SPA + TLS | 80, 443, 8080 |
| backend | API | 3000 |
| postgres | DB relacional | 5431→5432 |
| mongodb | Histórico/chat | 27018→27017 |
| redis | Filas/cache | interno |
| certbot | Renovação SSL | — |

## 10. Funcionalidades existentes

### Autenticação
- Login e registro com JWT + bcrypt.
- `/api/auth/me`.
- Rate limit em auth.
- Front: Protected/Public routes; persistência `feedagent-auth-storage` / `feedagent-session` (legado de nome).
- Recuperação de senha: **UI stub** (sem endpoint).
- MFA / RBAC avançado: **Não identificado**.

### Usuários e empresas
- Modelo `User` simples (sem multi-tenant Company/Role).
- Tenants / equipes / operadores: **Não identificado**.

### WhatsApp
- Multi-instância, QR via SSE, connect/restart/logout.
- Envio texto/mídia; histórico de mensagens; chat em tempo real.
- Broadcast round-robin via fila.
- Aquecimento / health score / eSIM: **Não identificado no código desta branch** (há PDF/plano e branch remota `aquecimento-de-contas`).

### Campanhas
- Lançamento real via `POST /drafts/broadcast/launch`.
- Histórico/KPIs via analytics.
- Pause/cancel/retry/CSV admin: **parcialmente simulados no front**.

### CRM e atendimento
- Chat 1:1 com contatos mapeados a instâncias.
- Leads/funis/etiquetas avançadas: **Não identificado** (categoria de contato é majoritariamente UI).

### eSIM e telefonia
- **Não identificado no estado atual do projeto.**

### Administração
- Dashboard KPIs.
- Help center estático.
- Audit / telemetry / API keys: rotas redirecionadas; páginas órfãs no código.

## 11. Alterações recentes identificadas

### Linha `chat-panel` / `Eduardo` (tip atual)

| Hash | Autor | Data | Mensagem | Resumo | Impacto | Risco |
|------|-------|------|----------|--------|---------|-------|
| `d6ad329` | Mauricio da Paixão Costa | 2026-07-21 | fix: remove certbot github dependencies and update ports | Ajuste nginx/init-letsencrypt | Deploy SSL | Médio (config infra) |
| `077dc58` | Mauricio… | — | ssl | Compose/nginx HTTPS | Produção TLS | Médio |
| `ae3859a` | Mauricio… | — | up | Subida stack SSL | Infra | Médio |

### Já em `main` (via PRs) — contexto

| Hash | Mensagem | Resumo |
|------|----------|--------|
| `5842a16` | Merge PR #3 chat-panel | Integra SSL/chat-panel em main |
| `3e77347` | chat page | Chat UI; remoção GestorPro do repo |
| `618768f` | Merge PR #1 Front | Branding ZapBusiness / UI milestones |

### Linha `Front` (não está no tip Eduardo)

| Hash | Autor | Mensagem | Arquivos | Impacto | Validação |
|------|-------|----------|----------|---------|-----------|
| `8c89191` | LCM-ENTERPRISE-LTDA | fix(contacts): alinha importação CSV ao formato da API | Contacts.tsx, contactImport.ts, teste | Corrige incompatibilidade CSV front↔API | Recomendada |
| `a1d0ca2` | LCM-ENTERPRISE-LTDA | Merge Front remoto | merge | Integração | — |
| `26f6e3e` / `dff157d` … | Branding ZB | Identidade visual | Já na história compartilhada | — |

### Observação neutra
Outro programador (Mauricio) avançou SSL/Docker na linha `chat-panel`. Outro fluxo (LCM / Front) avançou branding e correção de importação de contatos. As linhas **divergiram**; Eduardo herdou a ponta SSL, não o fix de CSV da Front.

## 12. Frontend

- React 19 + Vite 8 + TypeScript.
- Marca ZapBusiness (LCM no copyright).
- Layout responsivo, modal de conexão reconstruído (milestones 0.1.x).
- Chat ativo; React Query pouco utilizado.
- Chaves localStorage ainda prefixadas `feedagent-*`.
- PWA: manifest + ícones; **sem service worker**.
- Testes Vitest focados em UI compartilhada / brand / contacts layout.

## 13. Backend

- Express 5, Prisma (Postgres), Mongoose (Mongo), BullMQ, Baileys.
- Swagger em `/api-docs`.
- Filas OCR e broadcast; crons de limpeza.
- LLM local via `node-llama-cpp`; Gemini presente sobretudo em scripts de teste.
- Dockerfile executa `prisma db push --accept-data-loss` no boot (**risco alto**).

## 14. Banco de dados

### PostgreSQL (Prisma)

| Entidade | Finalidade | Relacionamentos |
|----------|------------|-----------------|
| User | Conta | Contact, Draft, WhatsAppInstance |
| Contact | Destinatários | User; unique (userId, phoneNumber) |
| Draft | Minutas / conteúdos | User; enum DraftStatus |
| WhatsAppInstance | Sessão WA | User |
| SystemConfig | Chave/valor | — |

### MongoDB

| Coleção/modelo | Finalidade |
|----------------|------------|
| FeedHistory | Histórico de envios / KPIs |
| ChatMessage | Mensagens por instância |

### Migrations
Pasta de migrations versionadas: **Não identificada**. Uso de `db push`.

## 15. Integrações externas

| Integração | Situação |
|------------|----------|
| WhatsApp (Baileys) | Ativa |
| Let's Encrypt | Ativa na linha Eduardo |
| Gemini API | Scripts / chave em compose (ver segurança) |
| Meta Graph oficial | **Não identificado** (Baileys não-oficial) |
| Gateways eSIM | **Não identificado** |

## 16. WhatsApp e sessões

- Sessões Baileys em disco (`sessions/`).
- Status sincronizado com Postgres.
- QR via SSE autenticado (token também via query string).
- Multi-instância com limite alto no front (ex.: 500).
- Isolamento por usuário nas APIs.

## 17. Campanhas e disparos

- Fluxo real: Draft APPROVED → launch → fila broadcast → WhatsAppInstanceManager.
- Front BroadcastQueue mistura API real e simulações (pause/cancel/retry/CSV).
- Delays/balanceamento avançados: parcialmente no worker; UI de controle avançado incompleta.

## 18. Gestão de contatos

- CRUD + import CSV multipart (`name`, `phoneNumber` no backend).
- Em **Eduardo**, o front ainda pode estar no modelo antigo de template (`Nome,Telefone,Categoria`) — o alinhamento está em `Front` (`8c89191`).
- Export CSV no front; categorias majoritariamente client-side.
- Validação de telefone alinhada a `phoneUtils` no backend (10–15 dígitos).

## 19. eSIM e telefonia

**Não identificado no estado atual do projeto.**

## 20. Filas, workers e tarefas agendadas

| Componente | Função |
|------------|--------|
| `ocr-processing-queue` | OCR → LLM → Draft |
| `broadcast-processing-queue` | Envio em massa |
| Cron 03:00 | Limpa uploads >24h |
| Cron 03:30 | Limpa drafts antigos |

## 21. APIs, rotas e webhooks

| Método | Rota | Auth | Módulo | Situação |
|--------|------|------|--------|----------|
| GET | `/health` | Pública | Ops | Implementada |
| POST | `/api/auth/register` | Pública + limiter | Auth | Implementada |
| POST | `/api/auth/login` | Pública + limiter | Auth | Implementada |
| GET | `/api/auth/me` | JWT | Auth | Implementada |
| * | `/api/contacts/*` | JWT | Contatos | Implementada |
| * | `/api/whatsapp/*` | JWT | WhatsApp | Implementada |
| * | `/api/news/*` | JWT + AI limiter | OCR/IA | Implementada |
| * | `/api/drafts/*` | JWT | Minutas | Implementada |
| GET | `/api/analytics/history` | JWT | Analytics | Implementada |
| GET | `/api/analytics/kpi` | JWT | Analytics | Implementada |
| GET | `/api-docs` | Pública | Docs | Implementada |
| GET | `/uploads/*` | Pública | Files | Implementada (risco) |

Webhooks Meta/oficial: **Não identificado**.  
SSE: QR, OCR job, mensagens chat.

## 22. Autenticação e permissões

- JWT (secret via env; default fraco possível no compose).
- Sem papéis (admin/operator) no schema.
- Register público.
- Extensão de sessão no front **não renova JWT** no servidor.

## 23. Configurações e variáveis de ambiente

| Variável | Serviço | Obrigatória | Finalidade | Sensível |
|----------|---------|------------:|------------|---------:|
| `DATABASE_URL` | Backend | Sim | Postgres | Sim |
| `MONGODB_URI` | Backend | Sim | Mongo | Sim |
| `REDIS_URL` | Backend | Sim | Redis/filas | Sim |
| `JWT_SECRET` | Backend | Sim | Assinatura JWT | Sim |
| `JWT_EXPIRES_IN` | Backend | Não | TTL token | Não |
| `PORT` | Backend | Não | Porta HTTP | Não |
| `NODE_ENV` | Backend | Não | Ambiente | Não |
| `LOG_LEVEL` | Backend | Não | Logs | Não |
| `MODELS_DIR` / `LLAMA_MODEL_FILE` | Backend | Cond. | Modelo LLM | Não |
| `ALLOWED_ORIGINS` | Compose/env | Intenção CORS | **Não aplicada no código** | Não |
| `VITE_API_URL` | Frontend build | Sim em prod | Base API | Não |
| `GEMINI_API_KEY` | Compose | Não recomendado hardcoded | Gemini | **Sim** |
| `DB_USER` / `DB_PASSWORD` / `DB_NAME` | Compose | Sim | Postgres | Sim |
| `MONGO_USER` / `MONGO_PASSWORD` | Compose | Sim | Mongo | Sim |

`.env.example`: **Não identificado**.  
Valores reais **omitidos** deste relatório.

## 24. Docker e infraestrutura

- Compose sobe stack completa; frontend nginx com domínio `autohist.com.br` (config).
- Volumes: certbot, sessions WA, uploads, logs, pgdata.
- Portas de DB publicadas no host (atenção em produção).
- Script `init-letsencrypt.sh` presente.

## 25. Testes e qualidade

| Área | Ferramenta | Observação |
|------|------------|------------|
| Front unit/UI | Vitest + RTL + axe | Cobertura parcial |
| Back unit/integration | Jest + Supertest | Poucos serviços cobertos |
| Modal WA | Playwright script | `validate:modal` |
| Lint | ESLint (front e back) | Presente |
| CI | `.github/workflows` no back-end | Presente |

## 26. Segurança

| Risco | Severidade | Arquivo/área | Impacto | Recomendação |
|-------|------------|--------------|---------|--------------|
| Chave Gemini hardcoded no compose | Crítico | `docker-compose.yml` | Comprometimento de cota/API | Remover do Git; rotacionar; usar secret |
| Scripts `test_gemini*` com API key | Crítico | `back-end/test_gemini*.ts` | Vazamento | Remover/revogar |
| `prisma db push --accept-data-loss` no boot | Alto | `back-end/Dockerfile` | Perda de dados | Migrations versionadas |
| `/uploads` público | Alto | `index.ts` static | Exposição de arquivos | Auth ou URLs assinadas |
| Defaults senha DB/Mongo/JWT | Alto | compose | Acesso indevido | Forçar secrets fortes |
| CORS aberto (`cors()`) | Médio | backend | CSRF cross-origin | Usar `ALLOWED_ORIGINS` |
| JWT em query string (SSE) | Médio | auth SSE | Vazamento em logs | Header / cookie httpOnly |
| Register público | Médio | auth routes | Spam de contas | Invite / aprovação |
| Upload mídia WA sem limite MIME/size | Médio | WhatsAppController | DoS/storage | Limitar como news upload |
| `.env.local` possivelmente versionado | Alto | back-end | Segredo no histórico | Auditar git; rotacionar DB URL |
| Sessões Baileys em disco | Médio | `sessions/` | Sequestro de sessão WA | Permissões, backup cifrado |
| Swagger aberto | Baixo | `/api-docs` | Surface | Restringir em prod |

## 27. Bugs identificados

| Bug | Evidência | Severidade |
|-----|-----------|------------|
| Import CSV front desalinhado da API (nesta branch) | Template/headers PT vs `name,phoneNumber`; fix só em Front | Alto (UX/funcional) |
| Ações de campanha simuladas parecem reais | `setTimeout` em BroadcastQueue | Médio |
| Forgot password sem backend | Texto na própria UI | Médio |
| Profile não persiste no servidor | Só authStore local | Baixo |
| `ALLOWED_ORIGINS` ignorada | Código vs env | Médio |

## 28. Funcionalidades incompletas

- Reset de senha.
- Audit logs / telemetry / API keys (rotas stub).
- Controles avançados de campanha (pause/cancel/retry reais).
- Refresh token / extensão real de sessão.
- PWA offline (service worker).
- Multi-tenant / RBAC.
- eSIM / aquecimento (fora do tip Eduardo; branch remota separada).
- Categorias de contato no backend.

## 29. Dívidas técnicas

- Prefixo legado `feedagent-*` em storage.
- React Query instalado sem padrão de data fetching.
- `settingsStore` pouco/não integrado.
- Páginas órfãs (Audit, Telemetry, ApiKeys).
- Ausência de migrations Prisma versionadas.
- Componentes de página muito grandes (Contacts, Broadcast, OcrReader).
- Planilha financeira e PDF de aquecimento na raiz do repo (ruído).
- Cobertura de testes baixa em WhatsApp/OCR/Auth.

## 30. Riscos para produção

1. Secrets no repositório / compose.  
2. `db push --accept-data-loss`.  
3. Uploads públicos.  
4. Divergência Front vs Eduardo (import CSV / features).  
5. Portas de banco expostas.  
6. Dependência de Baileys (risco de banimento / quebra de protocolo).  

## 31. Diferenças entre documentação e código

| Documento | vs código |
|-----------|-----------|
| RELATORIO 0.1.x | Refletem Front; Eduardo tip = chat-panel SSL |
| Sprints (até 45) | Muitas histórias aspiracionais (não todas implementadas) |
| whatsapp_warmup_plan / PDF | Planejamento; não módulo completo no tip |
| `ALLOWED_ORIGINS` documentada no env | Não aplicada |
| Swagger | Pode divergir de rotas reais — validar periodicamente |

## 32. Recomendações de curto prazo

1. Manter desenvolvimento **somente** em `Eduardo`.  
2. Rotacionar/remover secrets expostos (Gemini, defaults).  
3. Trazer (cherry-pick autorizado) o fix `8c89191` de importação de contatos.  
4. Adicionar `.env.example` sem valores reais.  
5. Restringir CORS e `/uploads`.  
6. Documentar procedimento de deploy sem alterar main diretamente.

## 33. Recomendações de médio prazo

1. Introduzir migrations Prisma (abandonar `accept-data-loss`).  
2. Completar fluxo de campanhas (ações reais).  
3. Implementar reset de senha e refresh token.  
4. Aumentar testes WhatsApp/Auth/OCR.  
5. Unificar naming `feedagent` → `zapbusiness` no client storage (com migração).  
6. Avaliar branch `aquecimento-de-contas` e integrar com plano.

## 34. Recomendações de longo prazo

1. Multi-tenant / RBAC.  
2. Observabilidade (métricas, tracing).  
3. Estratégia oficial Meta Cloud API vs Baileys.  
4. Módulo eSIM se for roadmap de produto.  
5. PWA completa + hardening segurança contínuo.

## 35. Roadmap sugerido

| Fase | Foco |
|------|------|
| M0 | Docs + higiene secrets + sync import CSV |
| M1 | Estabilidade campanhas + auth |
| M2 | Qualidade (migrations, testes, CORS/uploads) |
| M3 | Features produto (aquecimento / tenant) sob especificação |

## 36. Arquivos que exigem atenção

| Arquivo | Motivo |
|---------|--------|
| `docker-compose.yml` | Secrets / ports / SSL |
| `back-end/Dockerfile` | `db push --accept-data-loss` |
| `back-end/src/index.ts` | CORS, static uploads |
| `front-end/src/pages/Contacts.tsx` | Import CSV (desatualizado vs Front) |
| `front-end/src/pages/BroadcastQueue.tsx` | Simulações |
| `front-end/nginx.conf` | Domínio/TLS |
| `back-end/test_gemini*.ts` | Chaves |
| Possível `back-end/.env.local` | Segredo versionado |

## 37. Comandos disponíveis

### Frontend
```bash
cd front-end
npm install
npm run dev
npm run build
npm run lint
npm run typecheck
npm run test:run
```

### Backend
```bash
cd back-end
npm install
npm run dev
npm run build
npm test
npm run lint
```

### Stack
```bash
docker compose up -d --build
```

## 38. Resultado das validações

Executadas localmente em 22/07/2026 na branch `Eduardo` (sem alterar código de produto).

| Validação | Resultado | Observação |
|-----------|-----------|------------|
| Typecheck front | **OK** | `npm run typecheck` exit 0 |
| Testes front | **OK** | 7 files / 24 tests passed |
| Lint front | **Falhou** | 5 errors em `Chat.tsx` (`any` / unused vars) |
| Build front | **OK** | `tsc -b && vite build` exit 0 |
| Lint back | **Falhou** | 28 errors + 30 warnings (dívida pré-existente) |
| Testes back | Não executados nesta fase | Evitar dependência de infra DB/Redis sem necessidade |
| Instalação npm | Não forçada | `node_modules` já presentes; lockfiles não alterados pela auditoria |

## 39. Próximos passos recomendados

1. Autorizar **commit apenas dos arquivos `docs/`** (se desejado).  
2. Autorizar cherry-pick do fix de contatos para Eduardo.  
3. Plano de remoção de secrets + rotação.  
4. Definir primeiro milestone funcional em `docs/reports/`.  
5. **Não** mergear em `main` sem revisão e autorização.

## 40. Conclusão

O ZapBusiness é um monorepo maduro no fluxo **auth → WhatsApp → contatos → OCR/IA → drafts → broadcast → chat**, com identidade visual LCM e linha de deploy SSL em `Eduardo`/`chat-panel`. Há divergência importante com `Front` (import CSV) e riscos de segurança/infra que devem ser tratados antes de novas features. A branch **Eduardo** está pronta como base isolada para desenvolvimento privado, sem alterações em branches compartilhadas nesta auditoria.
