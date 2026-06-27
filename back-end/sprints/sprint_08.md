### Sprint 8: Modelagem de Contatos do UsuÃ¡rio (PostgreSQL)
- **Objetivo:** Estruturar onde as listas de transmissÃ£o serÃ£o salvas.
- **Tarefas:**
  - Criar a migraÃ§Ã£o para a tabela `contacts` (id, user_id, phone_number, name, active).
  - Estabelecer a relaÃ§Ã£o de One-to-Many entre `User` e `Contact`.
  - Desenvolver o `ContactEntity`.
  - Implementar constraints de unicidade para o nÃºmero de telefone por usuÃ¡rio.
