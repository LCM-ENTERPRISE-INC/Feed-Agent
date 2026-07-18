import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ResponsiveModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'md' | 'lg' | 'xl';
  labelledById?: string;
}

export const ResponsiveModal: React.FC<ResponsiveModalProps> = ({
  open,
  title,
  onClose,
  children,
  footer,
  size = 'md',
  labelledById = 'ui-modal-title',
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const sizeClass = size === 'lg' ? 'ui-modal--lg' : size === 'xl' ? 'ui-modal--xl' : '';

  return (
    <div className="ui-modal-overlay" role="dialog" aria-modal="true" aria-labelledby={labelledById} onClick={onClose}>
      <div className={`ui-modal ${sizeClass}`.trim()} onClick={(e) => e.stopPropagation()}>
        <div className="ui-modal__header">
          <h2 id={labelledById} className="ui-modal__title truncate" title={title}>
            {title}
          </h2>
          <button type="button" className="btn btn-ghost" onClick={onClose} aria-label="Fechar">
            <X size={18} aria-hidden />
          </button>
        </div>
        <div className="ui-modal__body">{children}</div>
        {footer ? <div className="ui-modal__footer">{footer}</div> : null}
      </div>
    </div>
  );
};

export default ResponsiveModal;
