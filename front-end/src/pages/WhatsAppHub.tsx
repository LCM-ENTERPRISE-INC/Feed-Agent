import React, { useState, useEffect } from 'react';
import { 
  Phone,
  Plus,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/Button';
import { showToast } from '@/utils/toastHelper';
import apiClient from '@/services/apiClient';
import { WhatsAppInstanceModal } from './WhatsAppInstanceModal';

import { useMultiplexedSse } from '@/hooks/useMultiplexedSse';
import type { SseEvent } from '@/hooks/useMultiplexedSse';

interface WhatsAppInstance {
  id: number;
  name: string;
  dbStatus: string;
  liveStatus: {
    state: string;
    qrCode?: string;
  };
  healthScore?: number;
}

const ConnectionCard: React.FC<{
  instance: WhatsAppInstance;
  onClick: () => void;
}> = ({ instance, onClick }) => {
  const [liveState, setLiveState] = useState(instance.liveStatus?.state || 'DISCONNECTED');
  const [healthScore, setHealthScore] = useState(instance.healthScore ?? 100);

  const handleSseEvent = (event: SseEvent) => {
    switch (event.type) {
      case 'connected':
        setLiveState('OPEN');
        break;
      case 'disconnected':
        {
          const data = event.payload as { reason?: number } | null;
          if (data?.reason === 403) setLiveState('BANNED');
          else setLiveState('DISCONNECTED');
        }
        break;
      case 'health':
        {
          const data = event.payload as { score?: number } | null;
          if (data?.score !== undefined) {
            setHealthScore(data.score);
            if (data.score === 0) setLiveState('BANNED');
          }
        }
        break;
      case 'qr':
        setLiveState('CONNECTING');
        break;
    }
  };

  useEffect(() => {
    const handler = (e: any) => handleSseEvent(e.detail);
    const eventName = `wa:sse:${instance.id}`;
    window.addEventListener(eventName, handler);
    return () => window.removeEventListener(eventName, handler);
  }, [instance.id]);

  const getStateDetails = (state: string) => {
    const s = state?.toLowerCase() || 'disconnected';
    if (s === 'open') return { label: 'Conectado', color: 'var(--success)' };
    if (s === 'connecting') return { label: 'Conectando / QR', color: '#eab308' };
    if (s === 'banned') return { label: 'Banido', color: 'var(--error)' };
    return { label: 'Desconectado', color: 'var(--text-muted)' };
  };

  const details = getStateDetails(liveState);
  const healthColor = healthScore > 79 ? 'var(--success)' : healthScore > 49 ? '#eab308' : 'var(--error)';

  return (
    <button
      type="button"
      className="glass-panel"
      style={{
        padding: 22,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        borderLeft: `3px solid ${details.color}`,
        cursor: 'pointer',
        textAlign: 'left',
        color: 'inherit',
        font: 'inherit',
        position: 'relative'
      }}
      onClick={onClick}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            backgroundColor: 'var(--primary-alpha)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: details.color,
          }}
        >
          <Phone size={20} />
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>{instance.name}</h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ID {instance.id}</span>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 12px',
          backgroundColor: 'var(--surface)',
          borderRadius: 8,
          border: '1px solid var(--border)',
        }}
      >
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Status</span>
        <span style={{ fontSize: '0.85rem', fontWeight: 650, color: details.color }}>{details.label}</span>
      </div>

      {/* Progress Bar de Saúde */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>Saúde da Conta</span>
          <span style={{ color: healthColor, fontWeight: 'bold' }}>{healthScore}%</span>
        </div>
        <div style={{ width: '100%', height: 6, backgroundColor: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${healthScore}%`, height: '100%', backgroundColor: healthColor, transition: 'width 0.3s ease, background-color 0.3s ease' }} />
        </div>
        {liveState === 'BANNED' && (
          <span style={{ fontSize: '0.75rem', color: 'var(--error)', marginTop: 4 }}>
            ⚠️ Atenção: Esta conta foi bloqueada pelo WhatsApp.
          </span>
        )}
      </div>
    </button>
  );
};

export const WhatsAppHub: React.FC = () => {
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInstance, setSelectedInstance] = useState<WhatsAppInstance | null>(null);

  const fetchInstances = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/whatsapp/instances');
      if (response.data?.success) {
        setInstances(response.data.data);
      }
    } catch (error) {
      console.error('Falha ao obter instâncias:', error);
      showToast.error('Falha ao carregar instâncias do WhatsApp.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstances();
  }, []);

  // Inicia o SSE Multiplexado global para a página
  useMultiplexedSse((event) => {
    window.dispatchEvent(new CustomEvent(`wa:sse:${event.instanceId}`, { detail: event }));
  });

  const handleCreateInstance = async () => {
    try {
      if (instances.length >= 500) {
        showToast.error('Você atingiu o limite máximo de 500 instâncias.');
        return;
      }
      await apiClient.post('/whatsapp/instances', { name: `Dispositivo ${instances.length + 1}` });
      showToast.success('Nova instância criada com sucesso!');
      await fetchInstances();
    } catch {
      showToast.error('Erro ao criar instância.');
    }
  };

  const handleDeleteInstance = async (id: number) => {
    if (!window.confirm('Tem certeza que deseja deletar esta instância? Todas as conexões serão perdidas.')) return;

    try {
      await apiClient.delete(`/whatsapp/instances/${id}`);
      showToast.success('Instância deletada.');
      setSelectedInstance(null);
      await fetchInstances();
    } catch {
      showToast.error('Erro ao deletar instância.');
    }
  };

  // getStateDetails was moved to ConnectionCard

  return (
    <div className="page-stack">
      {selectedInstance && (
        <WhatsAppInstanceModal
          instanceId={selectedInstance.id}
          instanceName={selectedInstance.name}
          initialWaState={selectedInstance.liveStatus?.state || 'DISCONNECTED'}
          onClose={() => {
            setSelectedInstance(null);
            fetchInstances();
          }}
          onDelete={() => handleDeleteInstance(selectedInstance.id)}
        />
      )}

      <div className="page-hero">
        <div className="page-hero-copy">
          <h1>Conexão</h1>
          <p>Conecte o canal via QR e acompanhe o status ao vivo de cada sessão.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="secondary" icon={RefreshCw} onClick={fetchInstances} isLoading={loading}>
            Atualizar
          </Button>
          <Button variant="primary" icon={Plus} onClick={handleCreateInstance} disabled={instances.length >= 500}>
            Nova instância
          </Button>
        </div>
      </div>

      {loading && instances.length === 0 ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <RefreshCw size={28} style={{ color: 'var(--primary)', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {instances.map((instance) => (
            <ConnectionCard
              key={instance.id}
              instance={instance}
              onClick={() => setSelectedInstance(instance)}
            />
          ))}
          {instances.length === 0 && !loading && (
            <div className="glass-panel" style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              Nenhuma instância ainda. Crie a primeira para escanear o QR.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
