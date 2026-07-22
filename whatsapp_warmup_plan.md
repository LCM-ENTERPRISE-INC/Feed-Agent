# Plano Estratégico de Aquecimento (Warm-up) de Contas WhatsApp

Este documento detalha o processo de aquecimento (warm-up) para novas contas (chips) de WhatsApp conectadas à plataforma. O objetivo é criar reputação e confiança com os algoritmos anti-spam da Meta, escalando o volume de disparos de forma segura até atingir a capacidade de **1.000 mensagens por dia** em um período de **3 semanas (21 dias)**.

> [!WARNING]
> **Risco de Banimento**
> Enviar centenas ou milhares de mensagens a partir de um chip recém-ativado resultará em banimento imediato e permanente. O algoritmo do WhatsApp monitora ativamente picos anormais de envio, falta de interações bidirecionais (respostas) e denúncias de spam.

---

## 🎯 Regras de Ouro do Aquecimento

Antes de iniciar o cronograma, certifique-se de seguir estas regras fundamentais durante todo o processo:

1.  **Perfil Humanizado e Completo:** Adicione uma foto de perfil real (evite logotipos muito genéricos nos primeiros dias), nome claro (ex: "João - [Nome da Empresa]"), recado atualizado e, se for WhatsApp Business, preencha o catálogo e horário de atendimento.
2.  **Foco em Receber Mensagens:** O algoritmo confia em números que *recebem* mensagens. Nos primeiros dias, peça para colegas, amigos e familiares enviarem mensagens para o novo número e responda a todas elas de forma orgânica.
3.  **Conversas Bidirecionais:** Nunca envie apenas comunicados. Faça perguntas que induzam o contato a responder (ex: *"Tudo bem com você?"*, *"Consegue confirmar o recebimento?"*). O WhatsApp avalia a proporção entre mensagens enviadas e recebidas.
4.  **Apenas Contatos Quentes (Opt-in):** Durante os 21 dias, envie mensagens **apenas** para clientes ou leads que já conhecem a empresa e que salvaram o seu número. Denúncias e bloqueios são fatais na fase de aquecimento.
5.  **Simulação Humana:** Ao utilizar a plataforma (Feed-Agent), o sistema já injeta pausas aleatórias e o status *"digitando..."*, mas evite disparar grandes blocos de mensagens de uma só vez. Distribua os envios ao longo do horário comercial.

---

## 📅 Cronograma de 3 Semanas (21 Dias)

### Fase 1: Maturação e Confiança Básica (Dias 1 a 7)
O objetivo desta fase não é vender nem notificar, mas sim provar para o WhatsApp que você é um usuário humano legítimo. O chip acabou de nascer e tem "zero reputação".

*   **Dias 1 a 3 (0 a 10 envios/dia):**
    *   **Ação:** Ative o WhatsApp no celular, preencha o perfil e entre em 2 ou 3 grupos de temas genéricos (não faça spam neles).
    *   **Interação:** Troque mensagens manualmente com 5 a 10 contatos conhecidos (familiares/funcionários). Mande áudios curtos, receba áudios e troque algumas imagens. Não use automação nestes primeiros 72 horas.
*   **Dias 4 a 7 (15 a 40 envios/dia):**
    *   **Ação:** Conecte o número ao sistema (QR Code).
    *   **Interação:** Inicie pequenos disparos pelo sistema (máximo de 5 a 10 por lote) para clientes muito próximos, enviando mensagens de relacionamento ou boas-vindas. Continue simulando uso humano no aparelho (postar 1 status por dia).

### Fase 2: Tração e Ganho de Volume (Dias 8 a 14)
Nesta fase, o número já possui uma base de confiança. O objetivo é introduzir mensagens de utilidade pública (notícias, comunicados) e aumentar a cadência diária.

*   **Dias 8 a 10 (50 a 100 envios/dia):**
    *   **Ação:** Comece a usar os disparos do "Estúdio de Minutas". Envie notícias relevantes para leads que solicitaram receber atualizações.
    *   **Interação:** Intercale mensagens de texto com links. Se enviar imagens, use legendas curtas. Mantenha o intervalo entre envios (delay) configurado para pelo menos 15 a 25 segundos no sistema.
*   **Dias 11 a 14 (120 a 300 envios/dia):**
    *   **Ação:** Aumente o limite em blocos. Faça disparos de 50 mensagens de manhã, 50 à tarde, etc.
    *   **Monitoramento:** Preste muita atenção aos feedbacks. Se notar que mensagens não estão chegando (apenas 1 check) ou receber avisos de bloqueio, recue imediatamente o volume para 50/dia por mais 3 dias.

### Fase 3: Escala para Alta Performance (Dias 15 a 21)
A conta está aquecida. Agora é o momento de testar a elasticidade do volume, rumo à marca de 1.000 mensagens.

*   **Dias 15 a 17 (350 a 600 envios/dia):**
    *   **Ação:** Aumente o tamanho das campanhas. Adicione novos contatos (opt-in) à lista de disparo.
    *   **Estratégia:** Continue incentivando a resposta no final das mensagens (ex: *"Responda OK para continuar recebendo nossas notícias grátis"*). Isso mantém a taxa de engajamento alta, protegendo a conta.
*   **Dias 18 a 21 (700 a 1.000+ envios/dia):**
    *   **Ação:** Acelere os envios. Você pode reduzir o delay do sistema para 5 a 10 segundos, desde que a base de contatos seja de altíssima qualidade (baixo risco de denúncia).
    *   **Estabilidade:** Se atingir 1.000 mensagens no dia 21 sem quedas de conexão ou avisos do WhatsApp, a conta está plenamente aquecida e pronta para operar em escala máxima como um nó de disparo do Feed-Agent.

---

> [!TIP]
> **Dica de Infraestrutura:** Se o seu objetivo é ultrapassar 2.000 ou 3.000 mensagens diárias no longo prazo, divida a carga conectando 2 ou 3 números diferentes na página de Conexões do sistema. O `broadcastWorker` fará o balanceamento (Round-Robin) entre as instâncias ativas, mantendo o volume por chip seguro e distribuído.
