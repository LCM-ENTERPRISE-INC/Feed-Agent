import { WarmupTypoService } from '../services/WarmupTypoService';

describe('WarmupTypoService', () => {
  describe('shouldDelete', () => {
    it('should return true if random is below probability', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.005);
      expect(WarmupTypoService.shouldDelete()).toBe(true);
    });

    it('should return false if random is above probability', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.5);
      expect(WarmupTypoService.shouldDelete()).toBe(false);
    });
  });

  describe('generateTypo', () => {
    beforeEach(() => {
      jest.restoreAllMocks();
    });

    it('should return original text if random is above probability', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.9);
      const result = WarmupTypoService.generateTypo('Tudo bem');
      expect(result).toEqual({ text: 'Tudo bem' });
    });

    it('should return original text if text is too short', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.01);
      const result = WarmupTypoService.generateTypo('Oi');
      expect(result).toEqual({ text: 'Oi' });
    });

    it('should generate a typo and a correction for valid text', () => {
      // Force typo generation
      // Math.random #1 (probability check) = 0.01
      // Math.random #2 (word selection) = 0.9 (picks last valid word)
      // Math.random #3 (char swap) = 0.1 (picks first swap position)
      
      let randomCalls = 0;
      jest.spyOn(Math, 'random').mockImplementation(() => {
        randomCalls++;
        if (randomCalls === 1) return 0.01; // Trigger typo
        if (randomCalls === 2) return 0.99; // Select last valid word
        if (randomCalls === 3) return 0.01; // Swap first possible chars
        return 0.5;
      });

      const input = 'Tudo ótimo, obrigado!';
      const result = WarmupTypoService.generateTypo(input);

      expect(result.text).not.toBe(input);
      expect(result.correction).toBeDefined();
      expect(result.correction?.startsWith('*')).toBe(true);
    });
  });
});
