### Sprint 37: Mecanismo de Retry em Falhas
- **Objetivo:** NÃ£o perder disparos em instabilidades momentÃ¢neas de rede.
- **Tarefas:**
  - Se o envio falhar por timeout de conexÃ£o, recolocar a mensagem na fila do BullMQ com uma contagem de tentativas (max: 3).
  - Atrasar exponencialmente cada nova tentativa (ex: tenta de novo em 1 min, depois 5 min).
