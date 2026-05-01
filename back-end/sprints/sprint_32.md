### Sprint 32: LÃ³gica de InserÃ§Ã£o de Log
- **Objetivo:** Registrar o status inicial.
- **Tarefas:**
  - Dentro do `broadcast-worker`, antes de cada disparo, criar um documento no MongoDB com status `pending`.
  - ApÃ³s chamar o `WhatsAppService.sendMessage`, atualizar o documento no Mongo para `sent` ou `failed` com o erro associado.
