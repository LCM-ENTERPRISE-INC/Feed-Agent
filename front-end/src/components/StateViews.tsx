import React from 'react';
import { StatePanel } from '@/components/StatePanel';

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
  description = 'Aguarde enquanto os dados são atualizados.',
}) => <StatePanel variant="loading" title={title} description={description} />;
