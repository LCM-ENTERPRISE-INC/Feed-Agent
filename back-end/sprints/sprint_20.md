### Sprint 20: Filas AssÃ­ncronas para OCR (BullMQ/Redis)
- **Objetivo:** Evitar bloqueio do Event Loop do Node em arquivos grandes.
- **Tarefas:**
  - Configurar Redis no `docker-compose.yml`.
  - Instalar `bullmq`.
  - Criar uma fila de processamento `ocr-queue`.
  - Enviar jobs de extraÃ§Ã£o para a fila e criar um Worker para processÃ¡-los em background.
  - Atualizar o status via WebSocket para o cliente.

---
