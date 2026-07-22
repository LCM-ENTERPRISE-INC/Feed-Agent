# Milestone 0.2.1 — Hardening versionado da VPS

**Data:** 2026-07-22  
**Branch:** `Eduardo`  
**Escopo:** Versionar hardenings aplicados só na VPS na Fase 1 — **sem deploy e sem push** nesta etapa.

---

## 1. Alterações que existiam apenas na VPS

| Item | Estado na VPS (Fase 1) |
|------|-------------------------|
| `prisma db push --accept-data-loss` removido | Patch local no Dockerfile |
| Portas 3000 / 5431 / 27018 fechadas | Patch local no compose |
| Nginx HTTP por IP | `deploy/nginx.phase1.conf` local |
| Secrets fortes em `.env` | Somente no servidor (`chmod 600`) |
| `trust proxy` | **Não** corrigido na VPS (warning ativo) |
| Certbot | Exit 1 sem DNS |

## 2. Correções versionadas nesta milestone

- Entrypoint `back-end/docker-entrypoint.sh` + Dockerfile sem `accept-data-loss`
- `DATABASE_SCHEMA_MODE` (`push` | `migrate` | `none`)
- Compose de produção sem publicar backend/DB/Redis
- `docker-compose.dev.yml` para portas locais explícitas
- `app.set('trust proxy', 1)` via `TRUST_PROXY_HOPS`
- `front-end/nginx.http.conf` e `nginx.https.conf`
- Certbot em `profiles: [tls]` com `restart: "no"`
- Healthchecks backend/frontend/redis (+ postgres/mongo já existentes)
- Remoção do secret Gemini hardcoded do compose
- `.env.deploy.example` atualizado

## 3. Estratégia Prisma

Não há pasta `prisma/migrations` versionada — **não** foram inventadas migrations.

| Modo | Uso |
|------|-----|
| `push` (default atual) | Temporário: `npx prisma db push` **sem** `--accept-data-loss` |
| `migrate` | Futuro: `npx prisma migrate deploy` — falha se não houver migrations |
| `none` | Não altera schema |

Container falha com log claro se o modo for inválido ou se `migrate` for pedido sem migrations.

**Produção futura:** criar migrations e mudar `DATABASE_SCHEMA_MODE=migrate`.

## 4. Portas (produção)

Publicadas no host:

- frontend: **80**, **443**

Não publicadas:

- backend 3000 (apenas `expose` na rede Docker)
- postgres / mongodb / redis

Dev: `docker compose -f docker-compose.yml -f docker-compose.dev.yml up`

## 5. Trust proxy

```ts
app.set('trust proxy', resolveTrustProxyHops()); // default 1
```

Teste unitário em `back-end/src/config/__tests__/trustProxy.test.ts`.

## 6. Nginx HTTP / HTTPS

| Arquivo | Quando |
|---------|--------|
| `nginx.http.conf` | Bootstrap IP / pré-certificado (default build) |
| `nginx.https.conf` | Após DNS + Let's Encrypt (`businesszap.com.br`, `www`, `api`) |

Build arg: `NGINX_CONF=nginx.http.conf` ou `nginx.https.conf`.

Sem `autohist.com.br`.

## 7. Certbot

```yaml
profiles: ["tls"]
restart: "no"
```

- `docker compose up -d` → **não** sobe certbot
- TLS: `docker compose --profile tls up -d` (somente autorizado, com DNS)

## 8. Healthchecks

- postgres / mongodb / redis: healthy antes do backend
- backend: `GET /health` (start_period 60s para schema)
- frontend: `wget` em `/` após backend healthy

## 9. Testes executados

| Check | Resultado |
|-------|-----------|
| `docker compose config` | OK — published only `80` e `443` |
| `docker compose build` | OK |
| Front typecheck / test / build | 38/38 + build OK |
| Back build | OK |
| `trustProxy` tests | 3/3 |
| `accept-data-loss` no código operacional | Ausente (só docs históricas / comentários de proibição) |
## 10. Rollback

```bash
git revert <hash-desta-milestone>
# Na VPS (quando autorizar update): git fetch && git checkout Eduardo && rebuild
```

## 11. Atualizar a VPS (quando autorizado — NÃO nesta etapa)

1. SSH como `businesszap`
2. `cd /opt/businesszap/app`
3. Backup `.env` (já local)
4. `git fetch origin && git checkout Eduardo && git pull --ff-only`
5. Reaplicar `.env` se necessário (`DATABASE_SCHEMA_MODE=push`, `TRUST_PROXY_HOPS=1`)
6. `docker compose build && docker compose up -d` (**sem** `--profile tls`)
7. Smoke: `/` e `/health`
8. **Não** `down -v` sem autorização

## 12. Pendências TLS

- DNS ativo para `businesszap.com.br` (+ www / api)
- Rebuild com `NGINX_CONF=nginx.https.conf`
- `ENABLE_TLS=true` / `ALLOWED_ORIGINS=https://...`
- Emitir certificado e só então `--profile tls`
- Migrations Prisma versionadas + `DATABASE_SCHEMA_MODE=migrate`

## 13. Status

Pronto para **atualizar a VPS** após push autorizado.  
Não pronto para TLS/WhatsApp/disparos.

---

*Fim Milestone 0.2.1*
