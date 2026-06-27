### Sprint 34: LÃ³gica Anti-Banimento (Throttling)
- **Objetivo:** Proteger a conta do WhatsApp do administrador contra bloqueios por spam.
- **Tarefas:**
  - Implementar um "delay" randÃ´mico entre 5 a 15 segundos entre cada mensagem dentro do loop do `broadcast-worker`.
  - Adicionar funcionalidade de pausa dinÃ¢mica se o Baileys detectar bloqueio temporÃ¡rio.
