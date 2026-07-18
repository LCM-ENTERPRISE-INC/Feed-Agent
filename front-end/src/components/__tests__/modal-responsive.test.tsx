import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResponsiveModal } from '@/components/ResponsiveModal';

describe('ResponsiveModal — viewport / close', () => {
  beforeEach(() => {
    document.body.classList.remove('modal-open');
  });

  afterEach(() => {
    document.body.classList.remove('modal-open');
  });

  it('mantém header e botão Fechar visíveis e trava scroll do body', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <ResponsiveModal open title="Conectar Canal" onClose={onClose} size="sheet">
        <div style={{ height: 1200 }}>Conteúdo longo</div>
      </ResponsiveModal>,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Conectar Canal' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeInTheDocument();
    expect(document.body.classList.contains('modal-open')).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('fecha com Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <ResponsiveModal open title="Conectar Canal" onClose={onClose}>
        <p>OK</p>
      </ResponsiveModal>,
    );
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});
