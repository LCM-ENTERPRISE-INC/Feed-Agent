import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

describe('Contatos — representação responsiva', () => {
  beforeEach(() => {
    getMock.mockReset();
    getMock.mockResolvedValue({
      data: {
        success: true,
        data: {
          data: [
            {
              id: 1,
              name: 'Ana Silva',
              phoneNumber: '5511999999999',
              active: true,
              createdAt: '2026-01-10T12:00:00.000Z',
            },
          ],
        },
      },
    });
  });

  it('renderiza tabela desktop e lista mobile no DOM', async () => {
    render(
      <MemoryRouter>
        <Contacts />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByText('Ana Silva').length).toBeGreaterThan(0);
    });

    expect(document.querySelector('.contacts-desktop-table')).toBeTruthy();
    expect(document.querySelector('.contact-mobile-list')).toBeTruthy();
  });
});
