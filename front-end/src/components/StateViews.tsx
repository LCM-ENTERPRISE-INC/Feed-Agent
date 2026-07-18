import React from 'react';
import { StatePanel } from '@/components/StatePanel';
import symbolUrl from '@/assets/brand/symbol.svg';
import { BRAND } from '@/config/brand';

export const EmptyState: React.FC<{
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}> = (props) => <StatePanel variant="empty" {...props} />;

export const ErrorState: React.FC<{
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}> = (props) => <StatePanel variant="error" {...props} />;

export const LoadingState: React.FC<{ title?: string; description?: string }> = ({
  title = 'Carregando',
  description = `Aguarde enquanto o ${BRAND.productName} atualiza os dados.`,
}) => (
  <div className="glass-panel state-panel" role="status" aria-live="polite">
    <span className="brand-splash" aria-hidden>
      <img src={symbolUrl} alt="" className="brand-splash__symbol" width={40} height={40} />
    </span>
    <div className="state-panel__title">{title}</div>
    {description && <p className="state-panel__desc">{description}</p>}
  </div>
);
