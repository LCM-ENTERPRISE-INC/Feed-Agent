import { WarmupAIFilterService } from '../services/WarmupAIFilterService';

describe('WarmupAIFilterService', () => {
  describe('Length Check', () => {
    it('should reject a seed message longer than 150 chars', () => {
      const longText = 'a'.repeat(151);
      expect(() => WarmupAIFilterService.validate(longText, 'seed')).toThrow('too long for seed');
    });

    it('should reject a reply message longer than 100 chars', () => {
      const longText = 'a'.repeat(101);
      expect(() => WarmupAIFilterService.validate(longText, 'reply')).toThrow('too long for reply');
    });

    it('should accept a valid short text', () => {
      const text = 'Tudo ótimo, obrigado!';
      expect(WarmupAIFilterService.validate(text, 'reply')).toBe(text);
    });
  });

  describe('Robotic Phrases Check', () => {
    it('should reject if text contains "aqui está"', () => {
      const text = 'Claro, aqui está a mensagem solicitada: Oi!';
      expect(() => WarmupAIFilterService.validate(text, 'seed')).toThrow('robotic phrase');
    });

    it('should reject if text contains "sou uma ia"', () => {
      const text = 'Desculpe, sou uma IA e não posso fazer isso.';
      expect(() => WarmupAIFilterService.validate(text, 'reply')).toThrow('robotic phrase');
    });
  });

  describe('Quotes formatting', () => {
    it('should remove starting and ending quotes', () => {
      const text = '"Opa blz"';
      expect(WarmupAIFilterService.validate(text, 'reply')).toBe('Opa blz');
    });

    it('should reject empty strings', () => {
      expect(() => WarmupAIFilterService.validate('   ', 'seed')).toThrow('empty text');
    });
  });
});
