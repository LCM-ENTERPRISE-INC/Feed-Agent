### Sprint 30: PreparaÃ§Ã£o do Motor de Broadcast
- **Objetivo:** Arquitetar a separaÃ§Ã£o entre aprovaÃ§Ã£o e envio em massa.
- **Tarefas:**
  - Criar um Worker especÃ­fico (com BullMQ) chamado `broadcast-worker`.
  - Ao aprovar uma minuta, agendar um job no BullMQ contendo o ID da Minuta e a lista de contatos do usuÃ¡rio na base.

---
