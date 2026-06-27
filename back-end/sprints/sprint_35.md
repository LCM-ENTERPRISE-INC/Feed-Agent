### Sprint 35: GestÃ£o de Contatos InvÃ¡lidos
- **Objetivo:** Manter a lista de transmissÃ£o limpa.
- **Tarefas:**
  - Se o Baileys retornar erro de "NÃºmero nÃ£o existe no WhatsApp", marcar automaticamente o contato no PostgreSQL como `active: false`.
  - Registrar a falha especÃ­fica no MongoDB com a tag de erro `invalid_number`.

---
