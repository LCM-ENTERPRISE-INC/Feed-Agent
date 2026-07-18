import React from 'react';

export type StatusTone = 'success' | 'warning' | 'error' | 'info' | 'neutral';

interface StatusBadgeProps {
  label: string;
  tone?: StatusTone;
  className?: string;
}

const toneToBadge: Record<StatusTone, string> = {
  success: 'badge-success',
  warning: 'badge-warning',
  error: 'badge-error',
  info: 'badge-primary',
  neutral: 'badge-neutral',
};

/** Badge de status com texto acessível (não depende só de cor). */
export const StatusBadge: React.FC<StatusBadgeProps> = ({ label, tone = 'neutral', className = '' }) => (
  <span className={`badge ${toneToBadge[tone]} ${className}`.trim()} role="status" aria-label={label}>
    {label}
  </span>
);

export default StatusBadge;
