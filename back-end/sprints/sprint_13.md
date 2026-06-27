### Sprint 13: PersistÃªncia de SessÃ£o do Baileys
- **Objetivo:** Evitar que o usuÃ¡rio precise escanear o QR Code sempre que o servidor reiniciar.
- **Tarefas:**
  - Implementar a persistÃªncia das chaves criptogrÃ¡ficas (`AuthState`) geradas pelo Baileys.
  - Criar uma pasta segura ou adaptar o salvamento de sessÃ£o diretamente no PostgreSQL/Redis.
  - Recuperar a sessÃ£o na inicializaÃ§Ã£o do serviÃ§o.
  - Tratar a invalidaÃ§Ã£o de sessÃ£o (quando o usuÃ¡rio desconecta no celular).
