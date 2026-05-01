### Sprint 24: Endpoint de GeraÃ§Ã£o de Minuta
- **Objetivo:** Integrar OCR e Llama em um endpoint coeso.
- **Tarefas:**
  - Criar endpoint `POST /api/news/generate-draft`.
  - O fluxo deve ser: Receber imagem -> OCR -> Extrair Texto -> Llama -> Retornar Minuta.
  - Retornar o tempo de processamento nas metas da resposta.
