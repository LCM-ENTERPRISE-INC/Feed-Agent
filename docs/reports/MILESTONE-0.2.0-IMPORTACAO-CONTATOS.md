# Milestone 0.2.0 — Importação de contatos CSV

**Branch:** `Eduardo`  
**Produto:** ZapBusiness (LCM Enterprise)  
**Data:** 2026-07-22  
**Escopo:** Corrigir importação CSV, validar build/testes, preparar domínio `businesszap.com.br` e roteiro de disparo controlado — **sem deploy e sem push**.

---

## 1. Problema original

Na branch `Eduardo`, a tela de Contatos enviava/esperava CSV incompatível com o contrato real da API (`name` + `phoneNumber`). O fix já existia na branch `Front` (`8c89191`) e **não** estava em `Eduardo`, o que quebrava a importação em ambiente alinhado a esta branch.

## 2. Causa

- Frontend gerava/parseava colunas diferentes das exigidas pelo backend (`parseCsvContacts` exige exatamente `name` e `phoneNumber`).
- Falta de utilitário compartilhado para normalizar máscaras, aliases de cabeçalho e resumo pré-envio.
- Backend **não** foi alterado neste milestone: o frontend passa a reescrever o CSV no formato canônico antes do `multipart`.

## 3. Commit analisado

```
8c89191 — fix(contacts): alinha importação CSV ao formato da API
```

Arquivos do commit:

| Arquivo | Papel |
|---------|--------|
| `front-end/src/pages/Contacts.tsx` | Fluxo de parse/upload |
| `front-end/src/utils/contactImport.ts` | Utilitário de normalização/CSV |
| `front-end/src/utils/__tests__/contactImport.test.ts` | Testes unitários |

**Conclusão:** o commit é isolado (apenas importação de contatos); não traz SSL, Docker, chat nem outras features da `Front`.

## 4. Decisão: cherry-pick vs portabilidade manual

- **Preferência aplicada:** `git cherry-pick 8c89191`
- **Resultado:** aplicado com sucesso, **sem conflitos**.
- Commit local intermediário: `517f756` (mesma mensagem do original).
- Em seguida: melhorias de regras CSV (aliases, máscaras, duplicados no arquivo, resumo, `;`), preparação de domínio e este relatório — consolidados no commit final `fix: corrige importação de contatos CSV`.

**Alterações de SSL / Docker / chat da branch Eduardo:** preservadas (não tocadas pelo cherry-pick).

## 5. Arquivos alterados (milestone)

| Arquivo | Mudança |
|---------|---------|
| `front-end/src/utils/contactImport.ts` | Aliases, normalização BR, duplicados, resumo, delimiter `,`/`;`, template |
| `front-end/src/utils/__tests__/contactImport.test.ts` | Cenários 1–10 + extras |
| `front-end/src/pages/Contacts.tsx` | Parse UTF-8, preview, upload canônico, toasts de resumo |
| `front-end/nginx.conf` | `businesszap.com.br` (sem IPs/creds) |
| `init-letsencrypt.sh` | Domínio/e-mail de exemplo `businesszap.com.br` |
| `front-end/.env.production.example` | `VITE_API_URL` / API futura |
| `.env.deploy.example` | Origens e placeholders sem secrets |
| `docs/reports/MILESTONE-0.2.0-IMPORTACAO-CONTATOS.md` | Este relatório |

**Não commitados:** `back-end/dist/**` (artefatos de build local).

## 6. Contrato CSV final

### 6.1 Contrato da API (inalterado)

| Item | Valor |
|------|--------|
| Rota | `POST /api/contacts/import` |
| Auth | JWT (`Authorization: Bearer …`) |
| Multipart | campo **`file`** |
| Cabeçalhos CSV no arquivo enviado | **`name`,`phoneNumber`** (exatos após lower/trim no parser) |
| Retorno | `{ imported, skipped, errors[] }` (HTTP 201) |
| Telefone | 10–15 dígitos após strip de não-numéricos |
| Duplicados | skip por `(userId, phoneNumber)` |
| Isolamento | sempre pelo `userId` do token |

### 6.2 Aceite no frontend (preview)

Cabeçalhos amigáveis aceitos no **arquivo do usuário**:

- Nome: `name`, `nome`
- Telefone: `phoneNumber`, `phone`, `telefone`, `celular` (case-insensitive; espaços/`_` ignorados)

Antes do upload, o frontend gera CSV canônico:

```csv
name,phoneNumber
Contato Teste 1,5562999999999
```

### 6.3 Regras de normalização (frontend)

- Remove espaços, `()`, `-`, `+` e demais não-numéricos.
- **Não** remove DDI se já presente (ex.: `55…`).
- Se 10–11 dígitos sem `55`, prefixa `55` (celular/fix BR local).
- Linhas sem nome/telefone → inválidas / “sem telefone”.
- Comprimento fora de 10–15 → inválido.
- Duplicata no próprio arquivo → marcada (primeira válida permanece).
- Duplicata já no banco → `skipped` na resposta da API.
- Nomes válidos preservados.
- Delimitador: `,` ou `;` (detecção pela primeira linha).

### 6.4 Resumo (preview)

Exemplo:

```
Total lido: 100 | Válidos: 82 | Duplicados no arquivo: 8 | Inválidos: 7 | Sem telefone: 3
```

Após API:

```
Total enviado: N | Importados: X | Duplicados (já existentes): Y | Inválidos (API): Z
```

## 7. Exemplos válidos

```csv
name,phoneNumber
Contato Teste 1,5562999999999
Contato Teste 2,5562988888888
```

```csv
Nome,Telefone
Maria,(62) 99999-1111
João,+55 62 98888-2222
```

```csv
name;phone
Ana;62977776666
```

## 8. Exemplos inválidos

- Arquivo vazio / só cabeçalho
- Sem coluna de telefone
- Linha vazia (ignorada no parse / sem dados)
- `123` (poucos dígitos)
- Telefone repetido duas vezes no mesmo CSV (2ª ocorrência = duplicado no arquivo)
- Cabeçalhos sem alias conhecido (`foo,bar`)

## 9. Testes executados

```bash
cd front-end
npm run typecheck          # OK
npm run test:run -- src/utils/__tests__/contactImport.test.ts
# → 14 passed
npm run test:run           # → 38 passed (8 files)
npm run build              # OK

cd back-end
npm run build              # OK
```

Cobertura dos cenários obrigatórios no `contactImport.test.ts`:

1. `name,phoneNumber`
2. `Nome,Telefone`
3. Máscara
4. `+55`
5. Linhas vazias
6. Número inválido
7. Duplicado no CSV
8. Sem coluna de telefone
9. Arquivo vazio
10. Separador `;`

## 10. Resultados

| Check | Resultado |
|-------|-----------|
| Cherry-pick `8c89191` | OK, sem conflitos |
| Frontend ↔ API | Compatível via rewrite canônico |
| Typecheck front | Passou |
| Testes importação | **14/14** |
| Suite front | **38/38** |
| Build front | Passou |
| Build back | Passou |
| Deploy / push | **Não realizados** |

## 11. Riscos

- Backend ainda **não** aceita aliases no arquivo multipart; se alguém POST direto sem o rewrite do front, `Nome,Telefone` falha.
- Prefixo automático `55` em números 10–11 dígitos pode afetar números não-BR futuros (aceitável para escopo BR atual).
- Certificados Let’s Encrypt / DNS ainda apontam para domínio antigo na VPS até o deploy futuro.
- Secrets em compose/scripts (audit anterior) permanecem — fora do escopo deste milestone.

## 12. Rollback

```bash
# Na branch Eduardo, desfazer o commit do milestone (somente se não tiver sido pushado):
git revert <hash-do-commit-milestone>
# ou voltar o tip para d6ad329 se ainda for o único commit local do marco
```

Restaurar nginx/`init-letsencrypt` para `autohist.com.br` se necessário em emergência de domínio antigo.

## 13. Preparação do domínio `businesszap.com.br`

**Alvo:**

- Frontend: `https://businesszap.com.br`
- API: `https://api.businesszap.com.br` (DNS + TLS futuros; hoje o nginx da app ainda faz proxy `/api` no mesmo host)

**Atualizado com segurança na branch Eduardo:**

- `front-end/nginx.conf`
- `init-letsencrypt.sh`
- `front-end/.env.production.example`
- `.env.deploy.example` (`ALLOWED_ORIGINS` placeholder)

**Ainda referenciam legado (docs/histórico; não bloqueiam o fix de CSV):**

- Relatórios antigos (`RELATORIO-0.1.*`, sprints, `whatsapp_warmup_plan.md`, etc.)
- Nome do repositório GitHub `Feed-Agent`
- Possíveis `.env` / compose **na VPS** (não alterados aqui)

**Não feito:** alteração de DNS, emissão de certificado, deploy VPS.

## 14. Pendências para deploy

1. Autorização explícita de push da `Eduardo` (ou PR controlado).
2. DNS: `A/AAAA` para `businesszap.com.br` (+ `www`) e `api.businesszap.com.br`.
3. TLS: rodar `init-letsencrypt.sh` (ou equivalente) **após** DNS propagado; confirmar e-mail real.
4. Variáveis de ambiente na VPS: `JWT_SECRET`, DB, Mongo, Redis, `ALLOWED_ORIGINS=https://businesszap.com.br,...` — **sem** commit de secrets.
5. Decidir se API pública usa subdomínio dedicado ou continua `/api` no mesmo host.
6. Smoke test pós-deploy: login → import CSV → listagem.
7. **Não** usar `prisma db push --accept-data-loss`.

## 15. Roteiro de teste controlado de disparo

> **Não executar sem autorização expressa.** Sem massa, sem campanha comercial, sem contatos não autorizados.

| Item | Valor sugerido |
|------|----------------|
| Contatos | 3–5 números **próprios** ou com autorização escrita |
| Instância | **Uma** sessão WhatsApp conectada |
| Mensagem | `Mensagem de teste técnico do BusinessZap. Nenhuma ação é necessária.` |
| Intervalo | Mínimo seguro já usado pelo produto (não reduzir artificialmente) |
| Repetição | **Desligada** — envio único |
| Verificação | Status de cada job/envio + registro no histórico |
| Critério de sucesso | Todos os 3–5 com status enviado/confirmado; zero spam residual |

Checklist pré-disparo:

- [ ] Autorização do dono do número
- [ ] Instância única estável
- [ ] Fila/campanha sem agendamento recorrente
- [ ] Monitoramento aberto (logs / UI de fila)
- [ ] Plano de abortar se ban/aviso do WhatsApp

## 16. Pronto para deploy?

**Não.** Milestone funcional local concluído na `Eduardo`; falta autorização de push, DNS/TLS/VPS e smoke em produção.

## 17. Dados da VPS ainda necessários (sem expor secrets)

- IP ou hostname atual do servidor
- Acesso SSH (usuário/chave) — fora do git
- Estado do DNS atual vs `businesszap.com.br`
- Caminho do deploy (`docker compose` / pasta do projeto)
- Conteúdo real de `.env` (conferência de `ALLOWED_ORIGINS`, URLs)
- Certificados existentes (`autohist` vs novo domínio)
- Qual branch a VPS está rodando hoje

---

*Fim do relatório Milestone 0.2.0.*
