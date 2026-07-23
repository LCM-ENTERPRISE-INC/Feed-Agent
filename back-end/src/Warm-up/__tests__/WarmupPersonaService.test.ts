import { WarmupPersonaService } from '../services/WarmupPersonaService';

describe('WarmupPersonaService', () => {
  it('should return a system prompt enforcing a casual human persona', () => {
    const prompt = WarmupPersonaService.getSystemPrompt();
    expect(prompt).toContain('casual');
    expect(prompt).toContain('NUNCA usa linguagem formal');
  });

  it('should return a seed message prompt with strict formatting rules', () => {
    const prompt = WarmupPersonaService.getSeedMessagePrompt();
    expect(prompt).toContain('gírias leves');
    expect(prompt).toContain('NUNCA use pontuação');
    expect(prompt).toContain('Não use aspas');
  });

  it('should inject the incoming message into the reply prompt', () => {
    const incoming = 'Oi, tudo bem?';
    const prompt = WarmupPersonaService.getReplyPrompt(incoming);
    expect(prompt).toContain(`"${incoming}"`);
    expect(prompt).toContain('1 a 5 palavras');
    expect(prompt).toContain('Não coloque aspas');
  });
});
