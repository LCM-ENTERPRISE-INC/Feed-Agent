# Walkthrough: Arquitetura e Integração do Bate-Papo (Frontend ↔ Backend)

Este documento detalha meticulosamente a arquitetura da solução de integração do Bate-Papo no projeto Feed Agent, unindo os desenvolvimentos da etapa inicial (estruturas base de tempo real) com as evoluções estruturais entregues posteriormente (Suporte a Anexos de Mídia, Histórico em Banco de Dados e Seleção de Múltiplos Canais).

## 1. Mapeamento das Rotas e Integrações Core

O funcionamento do Chat depende da orquestração de várias APIs e mecanismos de comunicação em tempo real e de arquivos. A comunicação é feita via HTTP REST e SSE (Server-Sent Events) para atualizações passivas.

### 1.1 Listagem de Contatos (Call List) e Canais
- **Endpoint de Contatos:** `GET /api/contacts?page=1&limit=1000`
- **Endpoint de Canais:** `GET /api/whatsapp/instances`
- **Fluxo no Frontend:** A barra lateral esquerda puxa a base de contatos para iniciar conversas. No topo, o aplicativo lista os canais (instâncias) de WhatsApp abertos e conectados.
- **Evolução (Seleção Dinâmica de Canal):** Diferente da versão inicial que travava a UI exigindo um "dispositivo global", hoje a plataforma **aprende qual dispositivo o contato usou**. O botão inteligente no topo busca em qual canal aquele contato já tinha histórico e o seleciona automaticamente. Se não houver, o usuário pode clicar no botão para abrir um **Grid Modal** e escolher por onde quer responder, de forma contextual.

### 1.2 Comunicação em Tempo Real de Mensagens (Ouvinte/Receiver)
- **Endpoint:** `GET /api/whatsapp/instances/:id/messages/stream?token=...`
- **Mecanismo:** `EventSource` (SSE)
- **Fluxo Funcional:** O Frontend abre uma conexão HTTP de via única contínua. O backend intercepta eventos `wa:message` gerados pela biblioteca Baileys e dispara pacotes JSON de volta para o cliente. 
- **Evolução (Persistência no MongoDB):** A versão inicial alertava que o histórico só existia na memória efêmera (`useState`). A persistência completa foi devidamente implementada! O `WhatsAppInstanceManager` escuta mensagens recebidas e enviadas, gravando tudo na coleção `ChatMessage` no MongoDB. Quando você clica em um contato, o Frontend faz um fetch imediato do banco (usando o endpoint inteligente `GET /api/whatsapp/instances/:id/messages?contact=...`), trazendo todo o passado da conversa de forma instantânea, resistindo a atualizações de página.

### 1.3 Envio de Mensagens de Texto
- **Endpoint:** `POST /api/whatsapp/instances/:id/send-message` (Refatorado semânticamente a partir do antigo endpoint de testes).
- **Fluxo Funcional:** A UI embute a mensagem instantaneamente (Optimistic UI) e a requisição aciona o método nativo do WhatsApp pelo backend.

---

## 2. O Novo Sistema de Anexos e Mídias 📎

Uma das maiores atualizações foi habilitar o suporte completo de mídia. A plataforma agora envia e recebe vídeos, áudios, imagens e documentos, com visualização rica nativa em ambos os lados da conversa.

### 2.1 Backend (Motor de Arquivos)
- **Servidor de Arquivos Estáticos:** O arquivo de inicialização (`index.ts`) foi atualizado para hospedar estaticamente o volume do Docker via `app.use('/uploads', express.static(...))`, permitindo que as fotos e vídeos sejam renderizados na web.
- **Upload via API (`POST /api/whatsapp/instances/:id/send-media`):** Rota recém-criada, acoplada ao middleware **Multer**. O frontend submete as imagens no formato `multipart/form-data` e o servidor as hospeda em disco com nomes únicos.
- **Integração com a Biblioteca Core (Baileys):**
  - **Envio:** O método `sendMedia` foi implementado no `WhatsAppService.ts`. Ele lê o arquivo local como `Buffer` no Node.js e despacha via WhatsApp de acordo com o padrão esperado pelo app do celular destino (analisando o `mimeType` para enviar como `image`, `video`, `audio` ou `document`).
  - **Download Automático:** O receiver de mensagens interceptoras (`messages.upsert`) detecta pacotes classificados como anexo (`imageMessage`, `videoMessage`, `audioMessage` e `documentMessage`). Ele usa a função nativa `downloadMediaMessage` para salvar a mídia na pasta `/uploads` e acopla a referência preenchendo as novas propriedades `mediaUrl` e `mediaType` no Banco de Dados.

### 2.2 Frontend (A Experiência Visual Rica)
- **Botão de Anexar Mídia:** Um ícone de Clipe de Papel chama o explorador de arquivos nativo do usuário (Suportando PDFs, Imagens, Vídeos, Áudios e Docs).
- **Barra de Prévia (Preview Box):** Antes de confirmar o envio, o arquivo selecionado fica fixado acima da caixa de digitação. O usuário pode preencher uma legenda de acompanhamento ou clicar no ícone `X` para cancelar o disparo.
- **Renderização Dinâmica na Bolha do Chat (Chat Bubbles):** O código frontend foi expandido para exibir elementos HTML de acordo com a mídia.
  - **Fotos (`image/*`):** Exibidas como miniaturas em formato fotográfico arredondado.
  - **Áudios (`audio/*`):** Renderiza um elemento HTML `<audio controls>` que permite dar Play, Pausa, acelerar e mudar o volume diretamente sem sair da tela do chat.
  - **Vídeos e Documentos:** Renderizam banners informativos e elegantes na mensagem com ícones descritivos.
- **Modal de Visualização Fullscreen:** Ao interagir clicando em fotos, vídeos ou arquivos PDFs na timeline, a tela inteira se escurece e o conteúdo é apresentado em tamanho real centralizado com controles nativos de navegação.

---

## 3. Correções Técnicas e Estabilidade (Fixes)
- **Erro de Tipagem Restritiva:** Durante o desenvolvimento do módulo de download do Baileys para o recebimento de mídias, a interface TypeScript acusou que um injetor nativo de logs (`this.socket`) poderia ser estaticamente inferido como "nulo" - impedindo o build da imagem do `back-end` do Docker (Erro 2531). O bug estrutural de CI/CD foi superado adicionando a verificação de asserção não-nula (`this.socket!`) que obriga o compilador a entender que naquele ciclo de escuta a instância Socket já está 100% operacional, destravando a publicação dos containeres Docker.

## Resumo da Arquitetura Atual
O Chat deixou de ser apenas um "prova de conceito de texto isolada" em memória e evoluiu para um sistema completo e multicanal. O histórico de mensagens está seguro e persistente no MongoDB de alta-escala, atualizações forçadas (F5) não deletam mais mensagens da tela, as rotas assumiram semânticas precisas, e o frontend adquiriu inteligência para manipular e renderizar dezenas de formatos de arquivos perfeitamente integrados ao Docker File-System.
