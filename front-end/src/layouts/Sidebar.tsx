import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home,
  Phone,
  Users,
  FileUp,
  FileText,
  Send as SendIcon,
  Settings,
  ChevronLeft,
  ChevronRight,
  BookOpen,
} from 'lucide-react';
import { BrandMark } from '@/components/BrandMark';
import { BrandCopyright } from '@/components/BrandCopyright';
import { BRAND, NAV_LABELS } from '@/config/brand';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onItemClick?: () => void;
}

type NavItem = { path: string; name: string; icon: React.ComponentType<{ size?: number; className?: string }> };
type NavSection = { label: string; items: NavItem[] };

const sections: NavSection[] = [
  {
    label: 'Operação',
    items: [
      { path: '/dashboard', name: NAV_LABELS.dashboard, icon: Home },
      { path: '/whatsapp', name: NAV_LABELS.whatsapp, icon: Phone },
      { path: '/contacts', name: NAV_LABELS.contacts, icon: Users },
    ],
  },
  {
    label: 'Conteúdo',
    items: [
      { path: '/ocr', name: NAV_LABELS.ocr, icon: FileUp },
      { path: '/drafts', name: NAV_LABELS.drafts, icon: FileText },
      { path: '/broadcast', name: NAV_LABELS.broadcast, icon: SendIcon },
    ],
  },
  {
    label: 'Conta',
    items: [
      { path: '/help', name: NAV_LABELS.help, icon: BookOpen },
      { path: '/settings', name: NAV_LABELS.settings, icon: Settings },
    ],
  },
];

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle, onItemClick }) => {
  const location = useLocation();

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`} aria-label="Navegação principal">
      <div className="sidebar-brand">
        <BrandMark compact={collapsed} to="/dashboard" />
      </div>

      <nav className="sidebar-nav">
        {sections.map((section) => (
          <div key={section.label}>
            <div className="nav-section-label" id={`nav-${section.label}`}>
              {section.label}
            </div>
            <ul className="nav-list" aria-labelledby={`nav-${section.label}`}>
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <li key={item.path} className="nav-item">
                    <Link
                      to={item.path}
                      onClick={onItemClick}
                      className={`nav-link ${isActive ? 'nav-link-active' : ''}`}
                      title={collapsed ? item.name : undefined}
                      aria-label={collapsed ? item.name : undefined}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <Icon size={20} className="nav-icon" aria-hidden />
                      {!collapsed && <span className="nav-text">{item.name}</span>}
                      {isActive && !collapsed && <span className="active-dot" aria-hidden />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        {!collapsed && <BrandCopyright compact className="sidebar-copyright" />}
        {collapsed && (
          <span className="sidebar-copyright-short" title={BRAND.companyName}>
            LCM
          </span>
        )}
        <button
          type="button"
          className="sidebar-collapse-btn"
          onClick={onToggle}
          aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
          aria-expanded={!collapsed}
        >
          {collapsed ? <ChevronRight size={18} aria-hidden /> : <ChevronLeft size={18} aria-hidden />}
          {!collapsed && <span>Recolher</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
