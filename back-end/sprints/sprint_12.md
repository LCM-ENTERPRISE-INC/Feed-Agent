### Sprint 12: GeraÃ§Ã£o e Envio de QR Code
- **Objetivo:** Permitir que o administrador conecte sua conta.
- **Tarefas:**
  - Capturar o evento de "qr" do Baileys.
  - Converter o cÃ³digo alfanumÃ©rico do QR para Base64/Imagem usando biblioteca como `qrcode`.
  - Expor endpoint via WebSocket ou SSE (Server-Sent Events) para enviar o QR Code em tempo real ao front-end.
  - Tratar timeouts de QR Code.
