import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Login } from '@/pages/Login';
import { BrandCopyright } from '@/components/BrandCopyright';
import { BRAND, brandCopyright } from '@/config/brand';

vi.mock('@/services/apiClient', () => {
  const client = { post: vi.fn(), get: vi.fn() };
  return { default: client, apiClient: client };
});

vi.mock('@/utils/toastHelper', () => ({
  showToast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

describe('Identidade ZapBusiness', () => {
  it('exibe ZapBusiness no login com by LCM', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );
    expect(screen.getAllByLabelText(BRAND.signature).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Zap').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Business').length).toBeGreaterThan(0);
    expect(screen.getAllByText(`by ${BRAND.companyShort}`).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: BRAND.loginCta })).toBeInTheDocument();
  });

  it('copyright exibe LCM Enterprise com ano dinâmico e assinatura', () => {
    render(<BrandCopyright />);
    const year = new Date().getFullYear();
    expect(screen.getByText(brandCopyright(year))).toBeInTheDocument();
    expect(screen.getByText(BRAND.signature)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(BRAND.companyName))).toBeInTheDocument();
  });

  it('credenciais de demonstração não aparecem no login (produção)', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );
    expect(screen.queryByText(/admin@feedagent/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Teste@123/i)).not.toBeInTheDocument();
  });

  it('meta title institucional está definido na configuração', () => {
    expect(BRAND.documentTitle).toContain('ZapBusiness');
  });
});
