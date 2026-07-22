# MILESTONE 0.2.2D — Bate-Papo (chat individual + tempo real)

**Branch:** `Eduardo`  
**Data:** 2026-07-22  
**Escopo:** frontend + backend (chat / WhatsApp transport / nginx SSE / CORS)  
**Deploy / push:** não realizados  
**Teste com WhatsApp real:** **NÃO** — aguardar autorização explícita

---

## Sintomas observados (antes)

| # | Sintoma | Evidência no código |
|---|---------|---------------------|
| 1 | Header quase sempre “Canal desconectado” | `Header.tsx` comparava `liveStatus.state === 'OPEN'`; Baileys/`WaConnectionState` usa `'open'` |
| 2 | SSE do chat quebrado em prod | `Chat.tsx` usava `VITE_API_BASE_URL`; o restante do app usa `VITE_API_URL` (`/api` no Docker) |
| 3 | Lista lateral = contatos cadastrados, não conversas | Boot chamava `/contacts?limit=1000` e `localStorage.contactInstanceMap` |
| 4 | Histórico falhava se socket não estivesse “vivo” | `getChatHistory` exigia instância live no manager |
| 5 | Sem status PENDING/SENT/ACK, sem retry idempotente | Persistência só criava doc pós-envio, sem lifecycle |
| 6 | Sem paginação cursor; limite fixo 100 | `ChatMessage.find(...).limit(100)` |
| 7 | CORS aberto | `app.use(cors())` ignorava `ALLOWED_ORIGINS` |
| 8 | Nginx sem location SSE dedicada | Buffering padrão podia atrasar/encerrar streams longos |

---

## Mapa do fluxo (FE → API → serviço → DB → transport → eventos → UI)

```
Boot UI
  → GET /api/whatsapp/instances          (status do canal; Postgres + liveStatus)
  → GET /api/whatsapp/conversations      (agregação Mongo ChatMessage por userId)

Abrir conversa
  → GET /api/whatsapp/instances/:id/messages?contact=&cursor=&limit=
       (ownership via Postgres WhatsAppInstance.userId; mensagens no Mongo)
  → EventSource .../messages/stream?token=JWT
       (SSE; nginx proxy_buffering off; X-Accel-Buffering: no)

Enviar
  → POST .../send-message { phoneNumber, message, clientMessageId }
       → ChatService: ownership + canal open → PENDING → Baileys send → SENT
       → receipts Baileys messages.update → DELIVERED/READ (+ FeedHistory)

Receber
  → Baileys messages.upsert → wa:message
       → ChatService.persistInbound (userId, unread, contact upsert sem dup de formato)
       → SSE event "message" → UI upsert sem refresh
```

**Stores:** Postgres (User, Contact, WhatsAppInstance) + Mongo (`ChatMessage`) + disco `sessions/instance_*` (Baileys).  
**Realtime:** SSE (não WebSocket/Socket.IO). Campanhas podem ter SSE próprio — não alterado nesta milestone além de nginx compartilhado.

---

## Endpoints

| Método | Rota | Função |
|--------|------|--------|
| GET | `/api/whatsapp/instances` | Status canais do usuário |
| GET | `/api/whatsapp/conversations?cursor&limit` | **Novo** — lista de conversas |
| GET | `/api/whatsapp/instances/:id/messages?contact&cursor&limit` | Histórico cursor (ownership DB) |
| GET | `/api/whatsapp/instances/:id/messages/stream` | SSE mensagens + `message:status` |
| GET | `/api/whatsapp/instances/:id/stream` | SSE QR/status |
| POST | `/api/whatsapp/instances/:id/send-message` | Envio texto + DTO com status |
| POST | `/api/whatsapp/instances/:id/send-media` | Envio mídia |

Auth: Bearer ou `?token=` (SSE). Isolamento por `req.user.userId` + `WhatsAppInstance.userId`.

---

## Causas-raiz (resumo)

1. **Bug de status no Header** (`OPEN` vs `open`) — falso “Canal desconectado”.
2. **Env errado no SSE do Chat** (`VITE_API_BASE_URL` vs `VITE_API_URL`).
3. **Modelo de produto incompleto no FE:** contatos + localStorage em vez de conversas persistidas.
4. **Histórico acoplado à sessão live** — quebrava após reload/restart até o socket subir.
5. **CORS / nginx SSE** inadequados para produção same-site + streams longos.

Rotas de mensagem/SSE **já existiam**; faltavam conversas, lifecycle, paginação, isolamento rígido via DB no histórico, e alinhamento FE.

---

## Correções

### Backend
- `ChatMessage`: `userId`, `status`, `clientMessageId`, `unread`, índices.
- `ChatService`: conversas, mensagens cursor, send PENDING→SENT/FAILED+retry idempotente, inbound, status ACK, variantes BR de telefone.
- `WhatsAppController` / routes: `/conversations`, histórico por ownership DB, SSE de status.
- `WhatsAppInstanceManager`: persistência via `ChatService`; ACK atualiza chat + feed.
- CORS com `ALLOWED_ORIGINS` + `credentials: true` (sem wildcard).
- Logs mascarados (`logMask` / phone mask); inbound Baileys sem telefone completo.

### Frontend
- `Chat.tsx` reescrito: boot status→conversas→mensagens→SSE; empty “Nenhuma conversa ainda.”; bloqueio de envio se desconectado; retry; cursor scroll-up; sem localStorage como fonte de verdade.
- `Header.tsx`: comparação case-insensitive com `'open'`.

### Infra
- `nginx.conf` / `nginx.http.conf` / `nginx.https.conf`: location SSE com `proxy_buffering off` (já presente na branch após 0.2.2C; validado para chat streams).
- `.env.deploy.example`: origins `https://businesszap.com.br` + `www`.
- `back-end/src/index.ts`: CORS via `ALLOWED_ORIGINS` + `credentials: true` (sem wildcard).

**Não alterado (campanhas):** `CampaignService` / controllers de campanha — apenas arquivos compartilhados mínimos (WhatsApp manager/controller/nginx/CORS).

---

## Testes

| Suite | Resultado |
|-------|-----------|
| `ChatService` (fake transport) | 8 passed |
| `phoneUtils` (variants + mask) | passed |
| FE `vitest run` | 40 passed |
| FE typecheck + build | ok |
| BE `tsc` build | ok |
| `docker compose config` | ok |
| `docker compose build backend frontend` | ok |
| Integração `flow.test.ts` (MongoMemoryServer) | falha **pré-existente** neste host Windows (`spawn EFTYPE`) — fora do escopo chat |

Script local: `back-end/scripts/validate-chat-fake-transport.ts`.

---

## Persistência / reconnect

- Sessões Baileys continuam em volume `sessions/instance_*` (compose `wa_sessions`).
- Após restart do backend, `loadAllInstances()` reinicia sockets; mensagens já gravadas no Mongo listam mesmo com canal `close`.
- Envio só com `liveStatus.state === 'open'`; UI e API retornam 503 claro.

---

## Deploy-ready?

**Parcialmente (código).** Imagens buildam; nginx/CORS alinhados.  
**Não deployar nesta milestone.**  
**Não testar WhatsApp real** até autorização (QR/sessão de produção).

Checklist pré-deploy sugerido (manual, depois):
1. `ALLOWED_ORIGINS` na VPS com `https://businesszap.com.br,https://www.businesszap.com.br`
2. Rebuild frontend (nginx SSE) + backend
3. Smoke: Header status, lista conversas, SSE, send com canal conectado em ambiente autorizado

---

## Commit

Mensagem: `fix: integra bate-papo e fluxo de mensagens em tempo real`  
**Hash:** `696d31bb8b90df3ff2ca76a047c44b7a48f8b219` (local, branch `Eduardo`; sem push)
