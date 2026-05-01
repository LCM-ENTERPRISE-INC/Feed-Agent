### Sprint 38: Cancelamento de Broadcast
- **Objetivo:** Permitir interromper envios em andamento.
- **Tarefas:**
  - Criar endpoint no dashboard para "Cancelar Disparo".
  - Implementar a lÃ³gica para remover jobs nÃ£o processados do Redis/BullMQ relativos Ã quela minuta.
  - Atualizar status da Minuta para `cancelled`.
