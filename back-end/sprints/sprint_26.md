## Fase 6: Pipeline Central e GestÃ£o de Minutas (Sprints 26-30)

### Sprint 26: Modelagem da Minuta (PostgreSQL)
- **Objetivo:** Persistir os rascunhos para posterior avaliaÃ§Ã£o.
- **Tarefas:**
  - Criar migraÃ§Ã£o para tabela `drafts` (id, user_id, original_text, generated_content, status [pending, approved, rejected], created_at).
  - Criar o `DraftEntity` e o repositÃ³rio respectivo.
  - Adaptar o endpoint de geraÃ§Ã£o para salvar o registro como `pending` no banco.
