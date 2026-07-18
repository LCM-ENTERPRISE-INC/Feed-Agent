import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StatePanel } from '@/components/StatePanel';
import { StatusBadge } from '@/components/StatusBadge';
import { ResponsiveModal } from '@/components/ResponsiveModal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button } from '@/components/Button';

describe('StatePanel', () => {
  it('exibe estado de carregamento', () => {
    render(<StatePanel variant="loading" title="Carregando" description="Aguarde" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Carregando')).toBeInTheDocument();
  });

  it('exibe erro e permite retry', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(
      <StatePanel
        variant="error"
        title="Falha ao carregar"
        description="Sem conexão"
        actionLabel="Tentar novamente"
        onAction={onAction}
      />,
    );
    expect(screen.getByText('Falha ao carregar')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});

describe('StatusBadge', () => {
  it('possui texto acessível no status', () => {
    render(<StatusBadge label="Conectado" tone="success" />);
    expect(screen.getByRole('status', { name: 'Conectado' })).toHaveTextContent('Conectado');
  });
});

describe('ResponsiveModal', () => {
  it('abre e fecha com botão e Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { rerender } = render(
      <ResponsiveModal open title="Detalhes" onClose={onClose}>
        <p>Conteúdo do modal</p>
      </ResponsiveModal>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Conteúdo do modal')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(onClose).toHaveBeenCalled();

    onClose.mockClear();
    rerender(
      <ResponsiveModal open title="Detalhes" onClose={onClose}>
        <p>Conteúdo do modal</p>
      </ResponsiveModal>,
    );
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});

describe('ConfirmDialog', () => {
  it('exige ação explícita de confirmação', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Confirmar disparo"
        description="Enviar para todos os contatos ativos?"
        confirmLabel="Confirmar"
        cancelLabel="Cancelar"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByText(/Enviar para todos/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(onConfirm).toHaveBeenCalled();
  });
});

describe('Button', () => {
  it('fica desabilitado durante processamento', () => {
    render(
      <Button isLoading variant="primary">
        Enviar
      </Button>,
    );
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
