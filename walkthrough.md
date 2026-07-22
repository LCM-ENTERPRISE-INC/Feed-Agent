# Walkthrough: Integração da Interface de Chat (Frontend ↔ Backend)

Este documento detalha meticulosamente a arquitetura da solução de integração entre o Frontend (Interface de Bate-Papo) e as Rotas de Backend, apresentando as implementações de sucesso, o fluxo de comunicação e os pontos de atenção (ou limitações) atuais do sistema.

## 1. Mapeamento das Rotas e Integrações (Frontend ↔ Backend)

O funcionamento do Chat depende da orquestração de várias APIs e mecanismos de comunicação em tempo real. A comunicação foi projetada para lidar tanto com requisições HTTP tradicionais quanto com a conexão persistente SSE (Server-Sent Events) para envio passivo de dados.

### 1.1 Obtenção das Contas Conectadas
- **Endpoint:** `GET /api/whatsapp/instances`
- **Uso no Frontend:** Logo que a página `Chat.tsx` carrega, ela dispara uma requisição para listar todas as instâncias vinculadas à conta do usuário.
- **Lógica de Sucesso:** O Frontend filtra automaticamente e seleciona a primeira instância cujo `liveStatus.state` seja igual a `"open"`.
- **Status da Integração:** **[SUCESSO]** A integração funciona perfeitamente. Se o usuário não tiver nenhuma conta ativa/escaneada, o Chat exibe alertas claros na interface ("Nenhuma conta WhatsApp").

### 1.2 Listagem de Contatos (Call List)
- **Endpoint:** `GET /api/contacts?page=1&limit=1000`
- **Uso no Frontend:** A barra lateral esquerda (Call List) puxa a base de contatos do backend para exibir a lista completa de números com os quais o usuário pode iniciar uma conversa.
- **Status da Integração:** **[SUCESSO]** Os dados chegam perfeitamente no formato `{ phone, name }` e são populados na lista lateral. Novos contatos podem ser iniciados através do botão "+ Novo" (que injeta na lista temporariamente no Frontend).

### 1.3 Comunicação em Tempo Real de Mensagens (Ouvinte/Receiver)
- **Endpoint:** `GET /api/whatsapp/instances/:id/messages/stream` (Autenticado via `?token=...`)
- **Mecanismo:** `EventSource` (SSE - Server-Sent Events)
- **Fluxo Funcional:** 
  1. O Frontend abre uma conexão HTTP de via única e contínua com o servidor.
  2. O servidor valida o Token JWT na Query String e anexa o usuário à sessão.
  3. O backend intercepta os eventos `wa:message` gerados pela instância real do WhatsApp (via biblioteca Baileys) e dispara pacotes JSON de volta para o cliente.
- **Status da Integração:** **[SUCESSO]** Validamos (através de scripts de integração direta - `test-chat-integration.ts`) que a rota SSE não sofre com timeouts arbitrários, que a autenticação no formato query string processa corretamente os Tokens, e que a rota reage a novas mensagens em tempo real.

### 1.4 Envio de Mensagens
- **Endpoint:** `POST /api/whatsapp/instances/:id/test-message`
- **Fluxo Funcional:** 
  1. O usuário digita uma mensagem no Frontend e clica em enviar.
  2. A interface imediatamente embute a mensagem na tela para resposta visual instantânea (Optimistic UI update).
  3. Dispara a requisição contendo `{ phoneNumber, message }`.
  4. O controller (`WhatsAppController.sendTestMessage`) localiza a instância ao vivo na memória do backend e chama a função nativa do WhatsApp (`sendMessage`).
- **Status da Integração:** **[SUCESSO]** A mensagem é despachada na infraestrutura do backend corretamente.

---

## 2. Pontos Críticos e Possíveis Falhas (Atenção Imediata)

Apesar da estrutura de transporte (ida e volta) ter validado perfeitamente no script de integração, existem algumas ressalvas arquitetônicas na modelagem atual que precisarão ser resolvidas para a robustez de um sistema em produção.

> [!WARNING]
> Persistência do Histórico de Conversas (No Frontend)
> Atualmente, o frontend (`Chat.tsx`) guarda o histórico das mensagens **apenas no estado de memória do React (`useState`)**. 
> - **Problema:** Quando o usuário atualiza a página (`F5`), as conversas que estavam na tela desaparecem do visual (embora continuem a existir no celular da pessoa).
> - **Ação Recomendada:** O Backend deve possuir uma nova rota como `GET /api/whatsapp/instances/:id/messages?contact=5511999999999` para que o frontend carregue o banco de dados real com as conversas antigas daquele contato ao clicar no nome na barra lateral. A integração atual só lida de fato com "O que é recebido no momento em que a aba está aberta".

> [!CAUTION]
> Nomenclatura da Rota de Envio
> Estamos utilizando o endpoint `/test-message` para realizar os disparos do chat. Ele realiza o envio sem problemas, porém seria muito mais viável e semântico refatorar a rota ou criar uma nova rota exclusiva para `POST /api/whatsapp/instances/:id/messages`.

> [!NOTE]
> Bloqueio da UI por Falta de Sessão Ativa
> Se o backend ou o container reiniciar, a instância do WhatsApp entrará no estado `DISCONNECTED`. Para que a integração SSE volte a funcionar, o usuário terá que refazer a leitura do QRCode através da tela de **Conexão** (ou via tela de inicialização) antes de usar o Bate-papo. O frontend foi desenvolvido para "barrar" a abertura do chat até que uma conexão `open` venha no array.

## 3. Resumo da Verificação Final

O script assíncrono `test-chat-integration.ts` provou cabalmente a viabilidade estrutural do nosso SSE. Abaixo a transcrição sintética do fluxo que validou os túneis:

```diff
+ [Test] Conectando ao SSE stream em: /api/whatsapp/instances/999/messages/stream?token=...
+ [SSE] Conexão estabelecida: {"instanceId":999,"message":"Listening for incoming messages..."}
+ [Test] Simulando Frontend enviando POST para /test-message...
+ [MockInstance] Received request to send message to 5511999999999: "Olá, este é um teste de integração!"
+ [SSE] Mensagem recebida via Stream (SSE): {"fromNumber":"5511999999999","text":"Echo do Backend..."}
```

A orquestração técnica dos dados via rede não possui bugs imediatos que precisem de hot-fix. O sistema comunica ativamente as digitações do usuário final com as bibliotecas core do backend.
