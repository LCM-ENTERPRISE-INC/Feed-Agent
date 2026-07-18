export type DraftStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type DraftPriority = 'Baixa' | 'Média' | 'Alta' | 'Urgente';

/** Cor semântica da prioridade (tokens CSS). */
export function draftPriorityColor(priority: DraftPriority | string): string {
  switch (priority) {
    case 'Baixa':
      return 'var(--info)';
    case 'Média':
      return 'var(--warning)';
    case 'Alta':
      return 'var(--warning)';
    case 'Urgente':
      return 'var(--error)';
    default:
      return 'var(--text-muted)';
  }
}
