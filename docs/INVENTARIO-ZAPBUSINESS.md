# Inventário ZapBusiness

**Data:** 22/07/2026  
**Branch auditada:** `Eduardo` (`d6ad329`)  
**Repositório:** Feed-Agent → produto ZapBusiness by LCM Enterprise

---

## Módulos

| Módulo | Localização | Situação |
|--------|-------------|----------|
| Autenticação | `back-end` Auth* + `front-end` Login/Register | Implementado |
| Contatos | Contact* + Contacts.tsx | Implementado (import CSV: ver divergência Front) |
| WhatsApp multi-instância | WhatsApp* + WhatsAppHub/Modal | Implementado |
| Chat | ChatMessage (Mongo) + Chat.tsx | Implementado |
| OCR / notícias | OcrService, News* + OcrReader | Implementado |
| Minutas / drafts | Draft* + DraftsStudio | Implementado |
| Broadcast / campanhas | broadcastQueue + BroadcastQueue | Parcial (UI com simulações) |
| Analytics | FeedHistory + Dashboard | Implementado |
| Brand / PWA | assets/brand, manifest | Implementado |
| SSL / Docker prod | docker-compose, nginx, certbot | Implementado (linha Eduardo/chat-panel) |
| eSIM / telefonia | — | **Não identificado** |
| Aquecimento de contas | docs PDF + branch remota `aquecimento-de-contas` | Planejamento / branch separada |
| Admin audit/telemetry/api-keys | páginas órfãs / redirects | Incompleto |

---

## Telas (frontend)

| Rota | Página | Nav |
|------|--------|-----|
| `/login` | Login | Pública |
| `/register` | Register | Pública |
| `/forgot-password` | ForgotPassword (stub) | Pública |
| `/dashboard` | Dashboard | Sim |
| `/whatsapp` | WhatsAppHub | Sim |
| `/chat` | Chat | Sim |
| `/contacts` | Contacts | Sim |
| `/ocr` | OcrReader | Sim |
| `/drafts` | DraftsStudio | Sim |
| `/broadcast` | BroadcastQueue | Sim |
| `/profile` | Profile (local) | Header |
| `/settings` | SettingsPage | Sim |
| `/help` | HelpCenterPage | Sim |
| `/audit`, `/telemetry`, `/api-keys` | Redirect → dashboard | Não |

---

## Componentes principais

| Componente | Pasta |
|------------|-------|
| BrandMark, BrandCopyright | `components/` |
| Button, Input, Alert, Badge, StatusBadge, Spinner | `components/` |
| ResponsiveModal, ConfirmDialog, PageHeader, EmptyState | `components/` |
| StatePanel, StateViews, ErrorBoundary | `components/` |
| ProtectedRoute, PublicRoute | `components/` |
| MainLayout, Header, Sidebar | `layouts/` |
| WhatsAppInstanceModal | `pages/` |

---

## Serviços (backend)

| Serviço | Arquivo |
|---------|---------|
| AuthService | `src/services/AuthService.ts` |
| UserService | `src/services/UserService.ts` |
| ContactService | `src/services/ContactService.ts` |
| DraftService | `src/services/DraftService.ts` |
| NewsGeneratorService | `src/services/NewsGeneratorService.ts` |
| LlamaService | `src/services/LlamaService.ts` |
| OcrService | `src/services/OcrService.ts` |
| UrlScraperService | `src/services/UrlScraperService.ts` |
| FeedHistoryService | `src/services/FeedHistoryService.ts` |
| WhatsAppService | `src/services/WhatsAppService.ts` |
| WhatsAppInstanceManager | `src/services/WhatsAppInstanceManager.ts` |

---

## Controllers

| Controller | Escopo |
|------------|--------|
| AuthController | register, login, me |
| ContactController | CRUD + import CSV |
| WhatsAppController | instâncias, SSE, send |
| NewsController | upload OCR, generate draft |
| DraftController | CRUD, approve/reject, broadcast launch |
| AnalyticsController | history, kpi |

---

## Rotas API (resumo)

Ver relatório técnico §21. Prefixo base: `/api`.

| Prefixo | Auth |
|---------|------|
| `/health` | Pública |
| `/api/auth/*` | Misto |
| `/api/contacts/*` | JWT |
| `/api/whatsapp/*` | JWT |
| `/api/news/*` | JWT |
| `/api/drafts/*` | JWT |
| `/api/analytics/*` | JWT |
| `/api-docs` | Pública |
| `/uploads/*` | Pública (estático) |

---

## Entidades

| Store | Entidade |
|-------|----------|
| PostgreSQL (Prisma) | User, Contact, Draft, WhatsAppInstance, SystemConfig |
| MongoDB | FeedHistory, ChatMessage |

---

## Migrations

| Item | Situação |
|------|----------|
| Pasta `prisma/migrations` | **Não identificada** no estado atual |
| Estratégia Docker | `prisma db push --accept-data-loss` no start do container |

---

## Integrações

| Integração | Uso |
|------------|-----|
| Baileys WhatsApp | Sessões, QR, envio |
| Redis / BullMQ | Filas OCR e broadcast |
| node-llama-cpp | Geração de conteúdo |
| Tesseract / sharp / pdf-parse | OCR |
| Cheerio / axios | Scraping URL |
| @google/genai | Scripts de teste (não fluxo principal `src/`) |
| Let's Encrypt / Certbot | TLS (compose Eduardo) |

---

## Jobs / workers / crons

| Nome | Tipo |
|------|------|
| `ocr-processing-queue` | Worker BullMQ |
| `broadcast-processing-queue` | Worker BullMQ |
| Limpeza uploads (03:00) | Cron |
| Limpeza drafts antigos (03:30) | Cron |

---

## Scripts

| Pacote | Scripts |
|--------|---------|
| front-end | `dev`, `build`, `lint`, `preview`, `typecheck`, `test`, `test:run`, `validate:modal`, `generate:brand` |
| back-end | `dev`, `build`, `start`, `test`, `test:coverage`, `lint`, `format`, `download-model` |
| raiz | `init-letsencrypt.sh` |

---

## Dockerfiles / Compose

| Arquivo | Função |
|---------|--------|
| `docker-compose.yml` | Stack completa |
| `front-end/Dockerfile` | Build Vite + nginx |
| `back-end/Dockerfile` | Multi-stage Node 20 |
| `front-end/nginx.conf` | SPA + proxy `/api` + SSL |

---

## Documentos existentes

| Documento | Local |
|-----------|-------|
| RELATORIO 0.1.1–0.1.4 | Raiz |
| RELATORIO aquecimento WhatsApp (PDF) | Raiz |
| backend_architecture_audit.md | Raiz |
| walkthrough.md, whatsapp_warmup_plan.md | Raiz |
| TOKENS.md | `front-end/docs/` |
| Sprints 01–45 | `front-end/sprints/`, `back-end/sprints/` |
| Este inventário + relatório + BRANCH-EDUARDO | `docs/` |

---

## Stores / hooks frontend

| Item | Arquivo |
|------|---------|
| authStore | `store/authStore.ts` |
| settingsStore | `store/settingsStore.ts` (pouco usado) |
| apiClient | `services/apiClient.ts` |
| useDocumentBrand, useTokenMonitor, useSseGateway, useOnlineStatus | `hooks/` |
