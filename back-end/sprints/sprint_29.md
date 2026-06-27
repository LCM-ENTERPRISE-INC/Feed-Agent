### Sprint 29: Endpoint de AprovaÃ§Ã£o e RejeiÃ§Ã£o
- **Objetivo:** Confirmar o fluxo final.
- **Tarefas:**
  - Criar `POST /api/drafts/:id/approve` e `POST /api/drafts/:id/reject`.
  - Mudar o status no banco de dados.
  - No caso de aprovaÃ§Ã£o, disparar o evento que inicia o Broadcast (Envio).
