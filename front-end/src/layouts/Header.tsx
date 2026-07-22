import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Sun, Moon, Wifi, Menu, ChevronDown, User, LogOut } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import apiClient from '@/services/apiClient';
import { BRAND, PAGE_TITLES } from '@/config/brand';

interface HeaderProps {
  onMenuClick: () => void;
  theme: 'light' | 'dark';
  onThemeToggle: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick, theme, onThemeToggle }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [connectedCount, setConnectedCount] = useState(0);
  const [statusLoading, setStatusLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchStatus = () => {
      apiClient
        .get('/whatsapp/instances')
        .then((res) => {
          if (res.data?.success) {
            const instances = res.data.data;
            const openCount = instances.filter(
              (inst: { liveStatus?: { state?: string } }) =>
                String(inst.liveStatus?.state || '').toLowerCase() === 'open',
            ).length;
            setConnectedCount(openCount);
          }
        })
        .catch(() => {})
        .finally(() => setStatusLoading(false));
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (!profileDropdownOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setProfileDropdownOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [profileDropdownOpen]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getInitials = (name?: string) => {
    if (!name) return 'US';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const pageTitle = PAGE_TITLES[location.pathname] || BRAND.productName;

  let statusShort = 'Desconectado';
  let statusLong = 'Canal desconectado';
  if (statusLoading) {
    statusShort = 'Conectando';
    statusLong = 'Conectando canal';
  } else if (connectedCount > 0) {
    statusShort = 'Conectado';
    statusLong =
      connectedCount === 1
        ? 'Canal WhatsApp conectado'
        : `${connectedCount} canais WhatsApp conectados`;
  }

  return (
    <header className="app-header">
      <div className="header-left">
        <button type="button" className="mobile-menu-btn" onClick={onMenuClick} aria-label="Abrir menu de navegação">
          <Menu size={20} aria-hidden />
        </button>
        <p className="header-page-title" title={pageTitle}>
          {pageTitle}
        </p>
      </div>

      <div className="header-right">
        <div
          className="header-status-badge"
          title={statusLong}
          aria-label={statusLong}
          data-connected={connectedCount > 0 ? 'true' : 'false'}
          style={{
            backgroundColor:
              connectedCount > 0
                ? 'color-mix(in srgb, var(--success) 12%, transparent)'
                : statusLoading
                  ? 'color-mix(in srgb, var(--info) 14%, transparent)'
                  : 'color-mix(in srgb, var(--warning) 14%, transparent)',
            borderColor:
              connectedCount > 0
                ? 'color-mix(in srgb, var(--success) 28%, transparent)'
                : statusLoading
                  ? 'color-mix(in srgb, var(--info) 28%, transparent)'
                  : 'color-mix(in srgb, var(--warning) 30%, transparent)',
            color: connectedCount > 0 ? 'var(--success)' : statusLoading ? 'var(--info)' : 'var(--warning)',
          }}
        >
          <Wifi size={14} className="status-icon-glow" aria-hidden />
          <span className="status-text status-text--full">{statusLong}</span>
          <span className="status-text status-text--short">{statusShort}</span>
        </div>

        <button
          type="button"
          onClick={onThemeToggle}
          className="theme-switcher-btn"
          aria-label={theme === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro'}
          title={theme === 'light' ? 'Modo escuro' : 'Modo claro'}
        >
          {theme === 'light' ? (
            <Moon size={18} className="theme-icon theme-icon-rotate" aria-hidden />
          ) : (
            <Sun size={18} className="theme-icon theme-icon-rotate" aria-hidden />
          )}
        </button>

        <div className="profile-dropdown-container" ref={dropdownRef}>
          <button
            type="button"
            className="profile-trigger-btn"
            aria-expanded={profileDropdownOpen}
            aria-haspopup="menu"
            aria-label={`Menu da conta de ${user?.name || 'usuário'}`}
            onClick={() => setProfileDropdownOpen((o) => !o)}
          >
            <div className="profile-avatar" aria-hidden>
              {getInitials(user?.name)}
            </div>
            <span className="profile-name truncate" title={user?.name || 'Visitante'}>
              {user?.name || 'Visitante'}
            </span>
            <ChevronDown size={14} className={`dropdown-arrow ${profileDropdownOpen ? 'arrow-rotated' : ''}`} aria-hidden />
          </button>

          {profileDropdownOpen && (
            <div className="profile-dropdown-menu glass-panel" role="menu">
              <div className="dropdown-user-header">
                <span className="user-header-name truncate">{user?.name || 'Usuário'}</span>
                <span className="user-header-email">{user?.email || ''}</span>
              </div>
              <hr className="dropdown-divider" />
              <button
                type="button"
                className="dropdown-item"
                role="menuitem"
                onClick={() => {
                  setProfileDropdownOpen(false);
                  navigate('/profile');
                }}
              >
                <User size={16} aria-hidden />
                <span>Meu perfil</span>
              </button>
              <button type="button" className="dropdown-item dropdown-item-danger" role="menuitem" onClick={handleLogout}>
                <LogOut size={16} aria-hidden />
                <span>Sair</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
