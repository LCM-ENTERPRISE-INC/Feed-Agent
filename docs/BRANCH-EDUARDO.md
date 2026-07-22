# Branch Eduardo

## Objetivo

Esta branch é destinada ao desenvolvimento privado e isolado das funcionalidades conduzidas por Eduardo no projeto ZapBusiness (repositório histórico: Feed-Agent).

## Estado atual (auditoria 22/07/2026)

| Item | Valor |
|------|--------|
| Branch ativa | `Eduardo` |
| Tracking | `origin/Eduardo` |
| Tip (HEAD) | `d6ad329` — *fix: remove certbot github dependencies and update ports* |
| Equivalência | Tip idêntico a `origin/chat-panel` / `chat-panel` local |
| Branch base oficial identificada | `main` (`origin/HEAD` → `origin/main`, tip `5842a16`) |
| Relação com main | Eduardo está **3 commits à frente** de `main` (linha SSL/certbot) e **2 commits atrás** em relação a merges já incorporados em main via outros caminhos — ver relatório técnico |
| Working tree | Limpa (sem alterações locais não commitadas) |
| Stashes | Nenhum |
| Push | **Não autorizado nesta fase** — aguardar ordem expressa |

## Regras

- Não realizar merge automático para outras branches.
- Não alterar diretamente `main`, `master`, `develop`, `Front`, `chat-panel`, `production` ou staging.
- Não executar push forçado (`--force`, `--force-with-lease`).
- Não reescrever o histórico (`rebase`, `filter-branch`, `reset --hard`).
- Não remover alterações de outros desenvolvedores.
- Todo novo desenvolvimento deverá ser documentado.
- Cada milestone deverá possuir relatório próprio.
- Deploy somente mediante autorização expressa.
- Migrations somente após revisão.
- Alterações sensíveis devem possuir plano de rollback.
- Não versionar segredos; mascarar credenciais em documentos.

## Padrão de commits

Usar mensagens claras, por exemplo:

```text
feat: adiciona gerenciamento de contas WhatsApp
fix: corrige validação de contatos
docs: atualiza relatório técnico
refactor: reorganiza serviço de campanhas
test: adiciona testes do módulo de sessões
chore: atualiza configuração local
```

## Relatórios de milestone

Cada etapa futura deverá criar um arquivo no formato:

```text
docs/reports/MILESTONE-X.Y.Z.md
```

O relatório deverá informar:

- objetivo;
- arquivos alterados;
- funcionalidades;
- banco de dados;
- endpoints;
- testes;
- riscos;
- rollback;
- pendências.

## Observação sobre divergência com Front

A branch `Front` contém o commit `8c89191` (*fix(contacts): alinha importação CSV ao formato da API*), **ausente** em `Eduardo` no momento da auditoria. Qualquer portabilidade desse fix deve ser feita de forma controlada (cherry-pick ou merge autorizado), documentada e testada — sem sobrescrever o trabalho de SSL/Docker desta linha.
