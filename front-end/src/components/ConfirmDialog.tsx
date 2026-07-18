import React from 'react';
import { Button } from '@/components/Button';
import { ResponsiveModal } from '@/components/ResponsiveModal';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'primary',
  loading = false,
  onConfirm,
  onCancel,
}) => (
  <ResponsiveModal
    open={open}
    title={title}
    onClose={onCancel}
    footer={
      <div className="stack-actions stack-actions--end" style={{ width: '100%' }}>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant={tone === 'danger' ? 'danger' : 'primary'}
          onClick={onConfirm}
          isLoading={loading}
        >
          {confirmLabel}
        </Button>
      </div>
    }
  >
    <p className="text-break">{description}</p>
  </ResponsiveModal>
);

export default ConfirmDialog;
