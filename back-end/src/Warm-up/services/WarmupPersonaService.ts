export class WarmupPersonaService {
  /**
   * Returns the system prompt enforcing a casual human persona.
   */
  static getSystemPrompt(): string {
    return 'Você é um usuário normal do WhatsApp no Brasil. ' +
      'Você fala de forma muito natural, rápida e casual. ' +
      'Você comete pequenos erros gramaticais normais de quem digita rápido. ' +
      'Você NUNCA usa linguagem formal, robótica ou de atendimento ao cliente. ' +
      'Aja como um amigo ou colega de trabalho próximo.';
  }

  /**
   * Returns the generation prompt for initiating a conversation (Seed Message).
   */
  static getSeedMessagePrompt(): string {
    return 'Gere uma única mensagem curtíssima para puxar assunto com um conhecido no WhatsApp. ' +
      'REGRAS ABSOLUTAS: ' +
      '1. Máximo de 1 frase (5 a 10 palavras). ' +
      '2. Use gírias leves ou abreviações (ex: "opa", "blz", "vc", "tá", "tranquilo"). ' +
      '3. NUNCA use pontuação no final da frase (sem ponto final, sem exclamação, sem interrogação se for possível evitar ou use apenas uma). ' +
      '4. Não use aspas na resposta. ' +
      '5. Faça uma pergunta fechada disfarçada de saudação (Ex: "opa blz", "fala ai tranquilo", "bom dia, suave?").';
  }

  /**
   * Returns the generation prompt for replying to an incoming message.
   * @param incomingMessage The text of the message received.
   * @param history The recent conversation history.
   */
  static getReplyPrompt(incomingMessage: string, history: Array<{sender: 'me'|'other', message: string}> = []): string {
    let historyContext = '';
    if (history && history.length > 0) {
      historyContext = 'Contexto da conversa recente:\n' + 
        history.map(h => (h.sender === 'me' ? 'Você: ' : 'Eles: ') + h.message).join('\n') + 
        '\n---\n';
    }

    return `${historyContext}Responda de forma extremamente curta a seguinte mensagem recebida no WhatsApp: "${incomingMessage}".\n` +
      'REGRAS ABSOLUTAS: ' +
      '1. Responda com no máximo 1 a 5 palavras. ' +
      '2. Se for uma mensagem muito curta, responda apenas com um emoji (👍, 😂, 🙏) ou uma palavra de confirmação ("show", "blz", "tá", "ok"). ' +
      '3. Use abreviações casuais. ' +
      '4. Não coloque aspas, pontos finais ou formatação na resposta. ' +
      '5. Soe como se estivesse com pressa e digitando rápido pelo celular.';
  }
}
