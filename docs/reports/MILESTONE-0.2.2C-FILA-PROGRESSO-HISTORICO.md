# MILESTONE 0.2.2C — Fila, progresso e histórico de campanhas

**Branch:** `Eduardo`  
**Data:** 2026-07-22  
**Inclui:** correções da 0.2.2B (público-alvo / lote ≠ limite total)  
**Push / deploy / envio real:** **não** realizados

---

## Causas raiz (auditoria)

### 1) Modal “125 Contatos Ativos”
- **Origem:** texto **hardcoded** em `front-end/src/pages/DraftsStudio.tsx` (mock do sprint 35).
- **Não** vinha do banco nem de `contacts.length`.
- Aprovar a minuta (`POST /drafts/:id/approve`) **só** mudava status para `APPROVED` — **não** enfileirava BullMQ.

### 2) Progresso “0 de 0” / “TRANSMITINDO”
- `BroadcastQueue.tsx` usava **estado React local** (`jobs = []`) e rótulo fixo “TRANSMITINDO” mesmo sem campanha.
- Histórico vinha de `/analytics/history` (ou vazio) e o badge **“Maio/2026”** era hardcoded.
- SSE de campanha **não existia**.

### 3) Limitação real de audiência no lançamento
- Tela Campanhas pedia `/contacts?limit=1000`, mas a API limita a **100**.
- “Selecionar Todos” = só os IDs da página carregada.
- `launchBroadcast` recebia esse array e criava **1 job** com a lista inline.

### 4) Produção (read-only, prévia)
- `user_id=1`: **678** contatos ativos; `user_id=2`: 3.
- **0** drafts no Postgres no momento da auditoria.
- Mongo exigiu autenticação (contagem de histórico não concluída sem credenciais no script).

---

## Arquitetura corrigida

```
Prévia  POST /api/campaigns/audience-preview
Launch  POST /api/campaigns/launch  (também legado /drafts/broadcast/launch)
        → Campaign status PREPARING
        → materializa elegíveis (cursor/orderBy id, sem page UI)
        → createMany CampaignRecipient
        → addBulk BullMQ (batchSize padrão 125) jobId = campaignId:contactId
        → status QUEUED (falha se queuedJobs=0)
Progress GET /api/campaigns/:id/progress | /active | /:id/jobs | /history
SSE     GET /api/campaigns/events?token=JWT  (+ snapshot)
Worker  broadcast-processing-queue (concurrency 1) — job por contato
```

### Status oficiais
`DRAFT`, `PREPARING`, `QUEUE_FAILED`, `QUEUED`, `RUNNING`, `PAUSED`, `COMPLETED`, `PARTIAL_FAILED`, `FAILED`, `CANCELLED`

### Schema (Prisma, aditivo)
- `Campaign`
- `CampaignRecipient` (id determinístico `campaignId:contactId`)

### Lotes vs total
- **Batch size** (default **125**, env `BROADCAST_BATCH_SIZE`) = tamanho do `addBulk`, **não** limite da campanha.
- 678 elegíveis → **6** lotes: 125×5 + 53.

### Seleção
```json
{ "selectionMode": "all", "excludedIds": [], "skipAlreadySent": true }
{ "selectionMode": "specific", "contactIds": [1,2,3] }
```

### Anti-reenvio
- `skipAlreadySent` (default **true**): exclui telefones com histórico Mongo `sent|delivered|read` para o `draftId`.
- JobId determinístico impede recriação idempotente no BullMQ.
- **Não** reprocessar campanha antiga: criar nova só com elegíveis restantes.

### Canal
- Sem WhatsApp `open` → **409** `CHANNEL_DISCONNECTED` (não cria RUNNING vazio).

### Nginx SSE
- `location /api/campaigns/events` com `proxy_buffering off` em `nginx.conf` / `nginx.https.conf` / `nginx.http.conf`.

---

## Frontend
- `DraftsStudio`: modal usa prévia real; confirmação = approve + `/campaigns/launch`.
- `BroadcastQueue`: prévia, launch, progress/jobs/history do backend, SSE, mês dinâmico, sem “TRANSMITINDO” falso.

---

## Testes
- Backend unit: `CampaignService`, `broadcastQueue`, contatos/métricas — **28** passed.
- Frontend: typecheck, **40** tests, build OK.
- Backend `tsc` OK.
- `docker compose config` OK; build de imagens solicitado localmente (sem `up`/deploy).
- Integration `flow.test` depende de MongoMemoryServer (pode falhar no ambiente Windows por `spawn EFTYPE`) — comportamento de approve sem enqueue coberto na asserção atualizada.

---

## Arquivos principais
- `back-end/prisma/schema.prisma`
- `back-end/src/services/CampaignService.ts`
- `back-end/src/controllers/CampaignController.ts`
- `back-end/src/routes/campaigns.routes.ts`
- `back-end/src/queues/broadcastQueue.ts`
- `back-end/src/controllers/DraftController.ts` (launch legado)
- `front-end/src/pages/BroadcastQueue.tsx`
- `front-end/src/pages/DraftsStudio.tsx`
- `front-end/nginx*.conf`

---

## Riscos / rollback
- Schema push aditivo em deploy futuro (`DATABASE_SCHEMA_MODE=push`).
- Worker agora prioriza job unitário com `campaignId`; path legado multi-contato mantido.
- Rollback: reverter commit; tabelas novas podem permanecer vazias.

## Reteste seguro (sem reenviar aos já atingidos)
1. Deploy autorizado na branch Eduardo.
2. Confirmar canal desconectado → launch retorna 409.
3. Com canal conectado e `skipAlreadySent=true`, prévia deve mostrar elegíveis &lt; total se já houver histórico.
4. Não relançar a mesma minuta sem revisar `alreadySentContacts`.

---

## Pronto para deploy?
**Código local pronto após review.** **Não** deployado. **Não** conectar WhatsApp / **não** enviar nesta milestone.
