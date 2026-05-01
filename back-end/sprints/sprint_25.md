### Sprint 25: Fallbacks e Controle de Contexto
- **Objetivo:** Lidar com limitaÃ§Ãµes de tamanho (Context Window).
- **Tarefas:**
  - Implementar um divisor de texto (chunking) caso o OCR gere um texto maior que o limite de tokens do Llama.
  - Enviar chunks sequenciais ou em paralelo e combinar as minutas.
  - Implementar cache simples de requisiÃ§Ãµes idÃªnticas recentes para poupar processamento.

---
