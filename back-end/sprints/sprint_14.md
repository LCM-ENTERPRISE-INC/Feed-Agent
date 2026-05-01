### Sprint 14: Monitoramento de Status da ConexÃ£o
- **Objetivo:** Manter o dashboard informado sobre o status do WhatsApp.
- **Tarefas:**
  - Tratar o evento `connection.update`.
  - Lidar com desconexÃµes inesperadas (cÃ³digos 401, 500, etc) e implementar lÃ³gica de reconexÃ£o.
  - Criar endpoint `GET /api/whatsapp/status` para o painel de controle.
  - Emitir alertas em caso de banimento da conta.
