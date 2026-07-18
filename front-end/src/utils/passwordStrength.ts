/** Password strength calculation utility shared by Register and ForgotPassword. */
export const getPasswordStrength = (pass: string): { score: number; text: string; color: string } => {
  let score = 0;
  if (!pass) return { score, text: 'Vazio', color: 'var(--text-muted)' };

  if (pass.length >= 6) score++;
  if (/[A-Z]/.test(pass)) score++;
  if (/[a-z]/.test(pass)) score++;
  if (/[0-9]/.test(pass)) score++;
  if (/[^A-Za-z0-9]/.test(pass)) score++;

  const texts = ['Muito Fraca', 'Fraca', 'Média', 'Forte', 'Excelente'];
  const colors = [
    'color-mix(in srgb, var(--error) 40%, transparent)',
    'var(--error)',
    'var(--warning)',
    'var(--primary)',
    'var(--success)',
  ];

  return {
    score,
    text: texts[score - 1] || 'Muito Fraca',
    color: colors[score - 1] || 'var(--error)',
  };
};
