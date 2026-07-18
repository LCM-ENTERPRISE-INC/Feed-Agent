import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { StatePanel } from '@/components/StatePanel';
import { StatusBadge } from '@/components/StatusBadge';
import { ResponsiveModal } from '@/components/ResponsiveModal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';

async function expectNoAxeViolations(container: HTMLElement) {
  const results = await axe(container);
  expect(results.violations).toEqual([]);
}

describe('Acessibilidade básica (vitest-axe)', () => {
  it('StatePanel loading sem violações críticas', async () => {
    const { container } = render(
      <StatePanel variant="loading" title="Carregando" description="Aguarde" />,
    );
    await expectNoAxeViolations(container);
  });

  it('StatusBadge expõe nome acessível e passa no axe', async () => {
    const { container } = render(<StatusBadge label="Conectado" tone="success" />);
    expect(screen.getByRole('status', { name: 'Conectado' })).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('Modal com role dialog e Input com label', async () => {
    const { container } = render(
      <>
        <ResponsiveModal open title="Editar contato" onClose={() => undefined}>
          <Input label="Nome" />
        </ResponsiveModal>
        <Button type="button">Salvar</Button>
      </>,
    );
    expect(screen.getByRole('dialog', { name: /Editar contato/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Nome')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('ConfirmDialog com botões nomeados', async () => {
    const { container } = render(
      <ConfirmDialog
        open
        title="Confirmar disparo"
        description="Enviar agora?"
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />,
    );
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });
});
