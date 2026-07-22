# Deploy VPS — Fase 1 (HTTP por IP)

**Data:** 2026-07-22  
**Operador / branch:** Eduardo  
**Commit esperado/confirmado:** `dd2b2224329edf31e43417cda3db9c5ee8293354`  
**Domínio:** `businesszap.com.br` ainda em registro — **sem DNS/TLS nesta fase**  
**Acesso temporário:** `http://179.197.235.188/` (IP público operacional)  
**Relatório:** histórico da Fase 1 — sem secrets.

---

## 1. Objetivo da fase

Preparar VPS Ubuntu 24.04 para rodar BusinessZap pelo IP, com Docker oficial, firewall restrito, bancos não públicos, sem WhatsApp, sem disparos, sem certificado.

## 2. Recursos da VPS (resumo)

| Item | Valor |
|------|--------|
| OS | Ubuntu 24.04.4 LTS (noble) |
| Kernel | 6.8.0-134-generic (upgrade pendente para 6.8.0-136 — reboot recomendado depois) |
| Disco | ~48 GB (`/` ~47 GB livres no início) |
| RAM | ~3.8 GiB |
| CPU | 1 vCPU |
| Hostname | BusinessZap |
| App path | `/opt/businesszap/app` |

## 3. Pacotes / hardening base

Instalados: `ca-certificates`, `curl`, `gnupg`, `git`, `ufw`, `fail2ban`, `unzip`, `jq`, `htop`, Docker CE oficial + Compose plugin.

Usuário `businesszap` criado (sudo + grupo `docker`). Root **não** desativado.

## 4. Docker

- Instalação: repositório oficial Docker (não snap / não painel Hostinger)
- `docker` 29.x e `docker compose` 5.x ativos via systemd

## 5. Firewall (UFW)

Permitido: **22**, **80**, **443**  
Negado por padrão o restante.

**Não abertos:** 5432, 27017, 6379, 3000.

## 6. Git

- Clone: `https://github.com/LCM-ENTERPRISE-INC/Feed-Agent.git`
- Branch: `Eduardo`
- HEAD: `dd2b2224329edf31e43417cda3db9c5ee8293354` ✅

## 7. Auditoria do compose (antes da subida)

### Bloqueadores encontrados no commit

1. **`back-end/Dockerfile`:** `npx prisma db push --accept-data-loss` — **proibido**.
2. **Portas publicadas no host:** backend `3000`, postgres `5431`, mongo `27018`, frontend também `8080/443`.
3. **Nginx de produção** redirecionava HTTP→HTTPS e exigia certificado de domínio (incompatível com fase IP).
4. **Secret Gemini hardcoded** no `docker-compose.yml` do repositório (não repetido aqui).
5. Defaults fracos de senha no compose se `.env` ausente (placeholders do repositório — não usar em produção).

### Mitigações locais na VPS (sem commit / sem push)

| Arquivo | Ação local |
|---------|------------|
| `back-end/Dockerfile` | Removido `--accept-data-loss` → `npx prisma db push && node dist/index.js` |
| `docker-compose.yml` | Removidas publicações 3000/5431/27018/8080/443; só **80**; secrets via `${…}`; `ALLOWED_ORIGINS` via env |
| `front-end/nginx.conf` | Substituído por HTTP-only fase 1 (`deploy/nginx.phase1.conf`) |
| `.env`, `back-end/.env`, `front-end/.env.production` | Criados na VPS, `chmod 600`, valores **não** documentados |

Working tree na VPS ficou dirty de propósito (overrides locais).

## 8. Serviços após `docker compose up -d`

| Serviço | Status observado |
|---------|------------------|
| frontend | Up — `0.0.0.0:80->80` |
| backend | Up — **somente** `3000/tcp` interno |
| postgres | Healthy — sem publish no host |
| mongodb | Healthy — sem publish no host |
| redis | Up — sem publish no host |
| certbot | Exited(1) — esperado sem DNS/certs |

## 9. Build / schema

- `docker compose build`: OK
- Prisma: schema sincronizado com `db push` **sem** `--accept-data-loss`
- Logs: Postgres + Mongo conectados

## 10. Smoke tests

| Teste | Resultado |
|-------|-----------|
| `curl -I http://127.0.0.1/` | 200 OK (nginx) |
| `curl http://127.0.0.1/health` | JSON healthy |
| `curl http://<IP>/` | 200 OK |
| `curl http://<IP>/health` | JSON healthy |
| `curl http://<IP>/api/health` | 404 (rota real é `/health`, não `/api/health`) |

## 11. Portas públicas

Confirmado escuta no host: **22**, **80**  
Fechadas/filtradas: **443** (UFW allow mas sem serviço), **3000**, **5432/5431**, **27017/27018**, **6379**

## 12. Problemas / avisos

1. **express-rate-limit / trust proxy:** warning/erro `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` ao passar por nginx — corrigir depois com `app.set('trust proxy', 1)` (commit futuro).
2. **certbot** exit 1 — ignorar até DNS.
3. **Kernel upgrade pendente** — reboot planejado recomendado fora de janela crítica.
4. **1 vCPU / 4 GB** — stack sobe, mas margem baixa para OCR/WhatsApp futuros.
5. **Senha root compartilhada em chat** — **rotacionar** e preferir SSH key no usuário `businesszap`.
6. Secret Gemini ainda existe no histórico do Git do compose original — rotacionar na conta Google se era real; na VPS foi sobrescrito por env vazio/`GEMINI_API_KEY=`.
7. `docker compose` warning: atributo `version` obsolete.

## 13. Pendências

- DNS `businesszap.com.br` + `api.businesszap.com.br`
- TLS (Let's Encrypt) **só após DNS ativo**
- Commit futuro: remover `accept-data-loss` do Dockerfile no Git; portas; trust proxy; tirar secret hardcoded
- Login real / seed de usuário admin
- Conexão WhatsApp / QR
- Teste controlado de disparo (autorização expressa)
- Confirmar SSH key-only e então restringir root

## 14. Rollback

```bash
cd /opt/businesszap/app
sudo -u businesszap docker compose down   # sem -v (preserva volumes)
# reativar: docker compose up -d
```

**Não** usar `docker compose down -v` sem autorização (apaga dados).

## 15. Status final

| Item | Status |
|------|--------|
| SSH | OK |
| Docker oficial | OK |
| Branch/hash | OK (`Eduardo` @ `dd2b222…`) |
| Compose validado + harden local | OK |
| Build | OK |
| Serviços principais | OK |
| Health frontend (HTTP /) | OK |
| Health backend (`/health`) | OK |
| Portas públicas restritas | OK |
| Pronto para receber DNS | **Sim (infra base)** — TLS só depois |
| Pronto para teste controlado | **Não** — falta login/WA/autorização |
| TLS / DNS / QR / disparos | **Não executados** |

---

*Fim do relatório Fase 1 — sem secrets.*
