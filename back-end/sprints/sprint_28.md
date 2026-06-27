### Sprint 28: Endpoint de EdiÃ§Ã£o de Minuta
- **Objetivo:** Permitir correÃ§Ã£o humana no resultado da IA.
- **Tarefas:**
  - Criar `PUT /api/drafts/:id` permitindo alterar o `generated_content`.
  - Validar e sanitizar o texto enviado pelo front-end para prevenir injeÃ§Ãµes antes de salvar.
