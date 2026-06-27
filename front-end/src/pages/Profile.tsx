import React, { useState } from 'react';
import { User, Mail, ShieldAlert, History, Laptop, Smartphone, Tablet, Save } from 'lucide-react';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { useAuthStore } from '@/store/authStore';
import { showToast } from '@/utils/toastHelper';

interface SessionLog {
  id: string;
  device: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  ip: string;
  location: string;
  accessedAt: string;
}

const mockLogs: SessionLog[] = [];

export const Profile: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const updateProfile = useAuthStore((state) => state.updateProfile);

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [saving, setSaving] = useState(false);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      showToast.error('O nome completo não pode ficar vazio.');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      showToast.error('Por favor, forneça um e-mail corporativo válido.');
      return;
    }

    setSaving(true);

    setTimeout(() => {
      updateProfile({ name, email });
      setSaving(false);
      showToast.success('Dados cadastrais atualizados com sucesso no store global!');
    }, 1000);
  };

  const getDeviceIcon = (type: 'desktop' | 'mobile' | 'tablet') => {
    switch (type) {
      case 'mobile': return <Smartphone size={16} />;
      case 'tablet': return <Tablet size={16} />;
      default: return <Laptop size={16} />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Introduction Banner */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        borderBottom: '1px solid var(--border)',
        paddingBottom: '20px',
      }}>
        <h1 style={{
          fontSize: '2rem',
          fontWeight: 700,
          fontFamily: 'var(--font-heading)',
          letterSpacing: '-0.02em',
        }}>
          Minha Conta
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>
          Gerencie suas informações pessoais corporativas e audite os logs de sessões ativas
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: '32px',
        alignItems: 'start',
      }}>
        {/* Profile Edit Card */}
        <div className="glass-panel" style={{
          padding: '32px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: 'rgba(99, 102, 241, 0.1)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <User size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Dados Cadastrais</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Atualize seu nome de exibição no portal</p>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <Input
              label="Nome de Exibição"
              type="text"
              icon={User}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={saving}
            />

            <Input
              label="E-mail Administrativo"
              type="email"
              icon={Mail}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={saving}
            />

            <Button
              type="submit"
              variant="primary"
              icon={Save}
              isLoading={saving}
              style={{ alignSelf: 'flex-start', marginTop: '6px' }}
            >
              Salvar Alterações
            </Button>
          </form>
        </div>

        {/* Security Summary details */}
        <div className="glass-panel" style={{
          padding: '32px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              color: 'var(--error)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <ShieldAlert size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Controle de Acesso</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Detalhes de segurança da credencial</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderRadius: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Tipo de Conta:</span>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--primary)' }}>Super Administrador</span>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderRadius: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Sessão Iniciada em:</span>
              <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Hoje, {mockLogs.length > 0 ? mockLogs[0].accessedAt.split(' - ')[1] : '--:--'}</span>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderRadius: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Chave de Assinatura:</span>
              <span style={{ fontSize: '0.9rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>SHA256..2d83fa</span>
            </div>
          </div>
        </div>
      </div>

      {/* Audit Logs table */}
      <div className="glass-panel" style={{
        padding: '32px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        marginTop: '8px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            color: 'var(--success)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <History size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Logs de Sessões Recentes</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Monitore os acessos passados de sua conta corporativa</p>
          </div>
        </div>

        <div style={{ overflowX: 'auto', width: '100%' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            textAlign: 'left',
            fontSize: '0.9rem',
          }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Dispositivo / Browser</th>
                <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Endereço de IP</th>
                <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Localização Estimada</th>
                <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>Horário de Acesso</th>
              </tr>
            </thead>
            <tbody>
              {mockLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Nenhum log de sessão encontrado.
                  </td>
                </tr>
              ) : (
                mockLogs.map((log) => (
                  <tr key={log.id} style={{
                    borderBottom: '1px solid var(--border)',
                    backgroundColor: 'transparent',
                    transition: 'background-color 0.2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.01)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <td style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 500 }}>
                      <span style={{ color: 'var(--primary)' }}>{getDeviceIcon(log.deviceType)}</span>
                      <span>{log.device}</span>
                    </td>
                    <td style={{ padding: '16px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{log.ip}</td>
                    <td style={{ padding: '16px', color: 'var(--text-muted)' }}>{log.location}</td>
                    <td style={{ padding: '16px', textAlign: 'right', color: 'var(--text-muted)' }}>{log.accessedAt}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Profile;
