# MILESTONE 0.2.2A — Correção de métricas, paginação e dados demonstrativos dos contatos

**Branch:** `Eduardo`  
**Data:** 2026-07-22  
**Escopo:** frontend + backend (contatos / métricas)  
**Deploy / push:** não realizados nesta milestone

---

## Causa da diferença 678 × 100

1. O backend em `ContactController.findAll` aplica `limit = Math.min(100, …)`.
2. A listagem paginada devolvia no máximo **100 registros** por página (comportamento correto de paginação).
3. O frontend da tela Contatos tratava `contacts.length` (itens da página) como se fosse o **total da base**.
4. Resultado na UI: “100% (100)” enquanto a dashboard (outra fonte / contagem agregada) mostrava 678.

Os **678 contatos permanecem persistidos**; o problema era de **exibição / origem da métrica**, não de perda de dados.

---

## Endpoint afetado

| Uso | Método / rota |
|-----|----------------|
| Lista paginada | `GET /api/contacts?page=&limit=&q=&active=` |
| Métricas + ranking | `GET /api/contacts/stats` (novo) |
| Autenticação | `req.user.userId` em todos os handlers |

### Limite de paginação

- Padrão de listagem no controller: **20** (se omitido).
- **Máximo:** **100** (`Math.min(100, …)`).
- Frontend Contatos: page size selecionável 10 / 25 / 50 / **100**.

### Metadados de paginação

Resposta de listagem (já no formato `PaginatedResult`):

```json
{
  "data": [ /* até `limit` itens */ ],
  "total": 678,
  "page": 1,
  "limit": 100,
  "totalPages": 7
}
```

A contagem de métricas **não** carrega os 678 de uma vez; usa `GET /contacts/stats` com `count` no PostgreSQL.

---

## Correção frontend

Arquivo: `front-end/src/pages/Contacts.tsx`

- Lista via query params `page` / `limit` / `q` / `active`.
- Totais de status e gráfico mensal vêm de `/contacts/stats` (`stats.total`, `active`, `inactive`, `monthlyGrowth`).
- Rodapé: `Exibindo {start}–{end} de {total} contatos` + navegação primeira/anterior/próxima/última.
- Removido o ranking fictício baseado em `contacts.slice(0, 4)` + fórmula `24 - index * 5`.
- Título “Taxa de Conformidade e Status” → **“Status dos contatos”** (não havia regra de conformidade).
- Sem disparos: estado vazio (“Nenhum disparo realizado ainda.”).

---

## Correção backend

| Arquivo | Mudança |
|---------|---------|
| `ContactService.ts` | Filtros `q` / `active`; `getStats()` (totais + crescimento 6 meses UTC) |
| `ContactController.ts` | Query params enriquecidos; handler `stats` |
| `contacts.routes.ts` | `GET /stats` **antes** de `/:id` |
| `FeedHistoryService.ts` | `getTopRecipients(userId)` — Mongo aggregate `sent\|delivered\|read` |

---

## Origem dos dados fictícios (`disparo64` / 63 / 62)

Não havia fixture com esses nomes.

- `disparo64`, `disparo63`, `disparo62` eram **nomes reais** dos primeiros contatos da página 1.
- Os números **24 / 19 / 14 envios** vinham do frontend:

```ts
broadcastsCount: 24 - index * 5  // 24, 19, 14, 9
lastDelivery: 'Há 2 horas'
```

Ou seja: ranking demonstrativo sobrepostos a contatos reais da página.

### Removido

- Fórmula `24 - index * 5`
- Texto fixo `Há 2 horas`
- Uso de `contacts.length` como total geral das métricas
- Meses estáticos inventados no gráfico (substituídos por `createdAt` agregados no backend)

---

## Isolamento por usuário

- Listagem / stats / top recipients filtrados por `userId` do JWT.
- Ranking Mongo: `$match: { userId, status: { $in: ['sent','delivered','read'] } }`.
- Nomes do ranking resolvidos com `prisma.contact.findMany({ where: { userId, phoneNumber: { in } } })`.

Teste: usuário sem envios → lista vazia de top recipients (ver `FeedHistoryTopRecipients.test.ts`).

---

## Evolução de cadastros

- Últimos **6 meses** (UTC), contagem por `createdAt` do usuário.
- Labels via `toLocaleDateString('pt-BR', { timeZone: 'UTC' })`.
- Importação em lote no mês corrente aparece no mês atual se `createdAt` for dessa janela.

---

## Significado das métricas

| UI | Significado |
|----|-------------|
| Total na base | `COUNT(*)` contatos do usuário |
| Ativos / Inativos | flag `active` no PostgreSQL |
| Taxa ativa | `round(active/total*100)` |
| Evolução | novos cadastros por mês (`createdAt`) |
| Destinatários com mais disparos | histórico Mongo com status `sent` / `delivered` / `read` |

“Conformidade” foi removida do rótulo por não existir regra documentada.

---

## Cache

- Não há cache Redis de métricas de contatos no caminho auditado.
- Após import/CRUD a UI chama `refreshContactsData()` (lista + stats).
- Sem reload forçado permanente.

---

## Testes

**Backend**

- `ContactService.test.ts` — paginação `100` itens / `total` 678 / `totalPages` 7; `getStats`
- `FeedHistoryTopRecipients.test.ts` — status válidos, vazio, isolamento `userId`

**Frontend**

- `contacts.test.tsx` — “Exibindo 1–100 de 678”; total 678; página 2 “101–200”; empty ranking; ausência de `disparo64`

**Comandos executados**

- Frontend: `npm run typecheck`, `npm run test:run` (40), `npm run build`
- Backend: `npm run build`, Jest `ContactService|FeedHistoryTopRecipients` (16)

**Busca final:** sem ocorrências de `disparo64|63|62` / `24 envios` etc. no código de produto (apenas asserção negativa no teste).

---

## Arquivos alterados

- `back-end/src/controllers/ContactController.ts`
- `back-end/src/routes/contacts.routes.ts`
- `back-end/src/services/ContactService.ts`
- `back-end/src/services/FeedHistoryService.ts`
- `back-end/src/services/__tests__/ContactService.test.ts`
- `back-end/src/services/__tests__/FeedHistoryTopRecipients.test.ts` (novo)
- `front-end/src/pages/Contacts.tsx`
- `front-end/src/pages/__tests__/contacts.test.tsx`
- `docs/reports/MILESTONE-0.2.2A-METRICAS-CONTATOS.md` (este arquivo)

---

## Riscos

- Chat / outros consumidores que pedem `limit=1000` continuam limitados a **100** no backend (cap intencional).
- Ranking depende de `FeedHistory` Mongo com `userId` e status corretos; registros legados sem `userId` não entram.
- Labels de mês dependem do locale Node (`pt-BR`).

---

## Rollback

Reverter o commit desta milestone na branch `Eduardo`. Rotas novas (`/contacts/stats`) são aditivas; listagem permanece compatível com o formato paginado anterior.

---

## Resultado esperado em produção (após deploy autorizado)

- Contatos totais: **678** (ou o total real do usuário).
- Página 1: 100 linhas + “Exibindo 1–100 de 678”.
- Sem WhatsApp / sem envios: ranking vazio; campanhas hoje inalteradas.
- Sem nomes/números inventados de disparo.
- Nenhum truncate / delete em massa / alteração dos 678 contatos nesta milestone.
