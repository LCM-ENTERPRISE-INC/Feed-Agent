import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MainLayout } from '@/layouts/MainLayout';
import { useAuthStore } from '@/store/authStore';

vi.mock('@/services/apiClient', () => {
  const client = {
    get: vi.fn().mockResolvedValue({ data: { success: true, data: [] } }),
    post: vi.fn(),
  };
  return { default: client, apiClient: client };
});

vi.mock('@/hooks/useTokenMonitor', () => ({
  useTokenMonitor: () => ({
    secondsRemaining: 60,
    showWarningModal: false,
    extendSession: vi.fn(),
    logoutSession: vi.fn(),
  }),
}));

vi.mock('@/hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => true,
}));

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/dashboard" element={<div>Painel conteúdo</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('MainLayout / Sidebar mobile', () => {
  beforeEach(() => {
    useAuthStore.setState({
      token: 'test-token',
      isAuthenticated: true,
      user: { id: '1', name: 'Admin Teste', email: 'admin@feedagent.local' },
    });
  });

  it('renderiza layout autenticado com navegação', () => {
    renderLayout();
    expect(screen.getAllByLabelText('Navegação principal').length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/Menu da conta/)).toBeInTheDocument();
    expect(screen.getByText('Painel conteúdo')).toBeInTheDocument();
  });

  it('abre menu mobile e fecha com Escape', async () => {
    const user = userEvent.setup();
    renderLayout();

    await user.click(screen.getByRole('button', { name: /Abrir menu de navegação/i }));
    expect(screen.getByRole('dialog', { name: /Menu de navegação/i })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: /Menu de navegação/i })).not.toBeInTheDocument();
  });

  it('exibe status do WhatsApp no header', () => {
    renderLayout();
    expect(screen.getByLabelText(/WhatsApp|conectado/i)).toBeInTheDocument();
  });
});
