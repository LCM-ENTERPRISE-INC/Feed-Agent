### Sprint 39: ServiÃ§o de Limpeza de Dados (Cron Jobs)
- **Objetivo:** Evitar que os bancos cresÃ§am indefinidamente de forma inÃºtil.
- **Tarefas:**
  - Instalar `node-cron`.
  - Criar uma rotina para apagar imagens temporÃ¡rias do disco todo dia Ã s 03:00.
  - Criar rotina para expurgar minutas rejeitadas/pendentes antigas (mais de 30 dias) do PostgreSQL.
