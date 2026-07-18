import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from '@/components/Input';

describe('Formulários', () => {
  it('associa label ao campo e mostra erro de validação', async () => {
    const user = userEvent.setup();
    render(<Input label="E-mail" type="email" error="Informe um e-mail válido." />);
    const field = screen.getByLabelText('E-mail');
    expect(field).toBeInTheDocument();
    expect(screen.getByText('Informe um e-mail válido.')).toBeInTheDocument();
    await user.type(field, 'a@b.com');
    expect(field).toHaveValue('a@b.com');
  });
});
