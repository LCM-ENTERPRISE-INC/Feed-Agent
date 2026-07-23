import { AppError } from '../../utils/AppError';

export class WarmupAIFilterService {
  private static ROBOTIC_BLACKLIST = [
    'aqui está',
    'sou uma ia',
    'sou um modelo de linguagem',
    'inteligência artificial',
    'assistente virtual',
    'desculpe',
    'não posso',
    'claro,',
    'entendi,'
  ];

  /**
   * Validates if the AI output looks human and is not an hallucination or AI preamble.
   * Throws an Error if the text is invalid.
   */
  static validate(text: string, type: 'seed' | 'reply'): string {
    if (!text || text.trim().length === 0) {
      throw new Error('AI returned empty text');
    }

    const cleanText = text.trim();

    // 1. Length Check
    if (type === 'seed' && cleanText.length > 150) {
      throw new Error(`Text too long for seed message (${cleanText.length} chars)`);
    }

    if (type === 'reply' && cleanText.length > 100) {
      throw new Error(`Text too long for reply message (${cleanText.length} chars)`);
    }

    // 2. Robotic Phrases Check
    const lowerText = cleanText.toLowerCase();
    for (const phrase of this.ROBOTIC_BLACKLIST) {
      if (lowerText.includes(phrase)) {
        throw new Error(`Text contains robotic phrase: "${phrase}"`);
      }
    }

    // 3. Quotes at the beginning/end check (already handled in regex usually, but good for safety)
    if (cleanText.startsWith('"') && cleanText.endsWith('"')) {
      return cleanText.replace(/^["']|["']$/g, '').trim();
    }

    return cleanText;
  }
}
