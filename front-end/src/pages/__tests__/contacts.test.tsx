import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Contacts } from '@/pages/Contacts';

const getMock = vi.fn();

vi.mock('@/services/apiClient', () => {
  const client = {
    get: (...args: unknown[]) => getMock(...args),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  };
  return { default: client, apiClient: client };
});

vi.mock('@/utils/toastHelper', () => ({
  showToast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

function mockListPage(page: number, total = 678, limit = 100) {
  const start = (page - 1) * limit;
  const count = Math.min(limit, Math.max(0, total - start));
  const data = Array.from({ length: count }, (_, i) => {
    const n = start + i + 1;
    return {
      id: n,
      name: `Contato ${n}`,
      phoneNumber: `5562999${String(n).padStart(6, '0')}`,
      active: true,
      createdAt: '2026-07-22T12:00:00.000Z',
    };
  });
  return {
    data: {
      success: true,
      data: {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    },
  };
}

const emptyStats = {
  data: {
    success: true,
    data: {
      total: 678,
      active: 678,
      inactive: 0,
      activeRate: 100,
      inactiveRate: 0,
      monthlyGrowth: [{ name: 'jul/26', NovasInscricoes: 678 }],
      topRecipients: [],
    },
  },
};

describe('Contatos — paginação e métricas reais', () => {
  beforeEach(() => {
    getMock.mockReset();
    getMock.mockImplementation((url: string) => {
      if (String(url).startsWith('/contacts/stats')) return Promise.resolve(emptyStats);
      if (String(url).includes('page=2')) return Promise.resolve(mockListPage(2));
      return Promise.resolve(mockListPage(1));
    });
  });

  it('exibe total 678 e faixa 1–100 mesmo com página de 100 itens', async () => {
    render(
      <MemoryRouter>
        <Contacts />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Exibindo 1–100 de 678 contatos/i)).toBeTruthy();
    });
    expect(screen.getByText('678')).toBeTruthy();
    expect(screen.queryByText(/disparo64/i)).toBeNull();
    expect(screen.getByText(/Nenhum disparo realizado ainda/i)).toBeTruthy();
  });

  it('navega para a página 2 (101–200)', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Contacts />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Exibindo 1–100 de 678 contatos/i)).toBeTruthy();
    });

    await user.click(screen.getByLabelText('Próxima página'));

    await waitFor(() => {
      expect(screen.getByText(/Exibindo 101–200 de 678 contatos/i)).toBeTruthy();
    });
  });

  it('renderiza tabela desktop e lista mobile no DOM', async () => {
    render(
      <MemoryRouter>
        <Contacts />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByText('Contato 1').length).toBeGreaterThan(0);
    });

    expect(document.querySelector('.contacts-desktop-table')).toBeTruthy();
    expect(document.querySelector('.contact-mobile-list')).toBeTruthy();
  });
});
