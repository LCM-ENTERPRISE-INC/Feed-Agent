import React, { useState, useEffect } from 'react';
import { 
  Phone,
  Plus,
  RefreshCw, 
  Settings,
  Activity,
  AlertTriangle
} from 'lucide-react';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { showToast } from '@/utils/toastHelper';
import apiClient from '@/services/apiClient';
import { WhatsAppInstanceModal } from './WhatsAppInstanceModal';

interface WhatsAppInstance {
  id: number;
  name: string;
  dbStatus: string;
  liveStatus: {
    state: string;
    qrCode?: string;
  };
}

export const WhatsAppHub: React.FC = () => {
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInstance, setSelectedInstance] = useState<WhatsAppInstance | null>(null);

  const fetchInstances = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/whatsapp/instances');
      if (res.data?.success) {
        setInstances(res.data.data);
      }
    } catch (err) {
      console.error('Falha ao obter instâncias:', err);
      showToast.error('Falha ao carregar instâncias do WhatsApp.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstances();
    // Poll every 10 seconds to keep live states updated on the grid
    const interval = setInterval(fetchInstances, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateInstance = async () => {
    try {
      if (instances.length >= 5) {
        showToast.error('Você atingiu o limite máximo de 5 instâncias.');
        return;
      }
      await apiClient.post('/whatsapp/instances', { name: `Dispositivo ${instances.length + 1}` });
      showToast.success('Nova instância criada com sucesso!');
      await fetchInstances();
    } catch (err) {
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
    } catch (err) {
      showToast.error('Erro ao deletar instância.');
    }
  };

  const getStateDetails = (state: string) => {
    const s = state?.toLowerCase() || 'disconnected';
    if (s === 'open') return { label: 'Conectado', color: 'var(--success)' };
    if (s === 'connecting') return { label: 'Conectando / QR', color: '#eab308' };
    if (s === 'banned') return { label: 'Banido', color: 'var(--error)' };
    return { label: 'Desconectado', color: 'var(--text-muted)' };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {selectedInstance && (
        <WhatsAppInstanceModal 
          instanceId={selectedInstance.id}
          instanceName={selectedInstance.name}
          initialWaState={selectedInstance.liveStatus?.state || 'DISCONNECTED'}
          onClose={() => {
            setSelectedInstance(null);
            fetchInstances(); // refresh state on close
          }}
          onDelete={() => handleDeleteInstance(selectedInstance.id)}
        />
      )}

      {/* Title Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', borderBottom: '1px solid var(--border)', paddingBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em' }}>
            Gerenciador de Múltiplas Instâncias
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>
            Gerencie até 5 aparelhos simultâneos. As mensagens serão distribuídas automaticamente (Round-Robin).
          </p>
        </div>
        <Button variant="primary" icon={Plus} onClick={handleCreateInstance} disabled={instances.length >= 5}>
          Nova Instância
        </Button>
      </div>

      {loading && instances.length === 0 ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
          <RefreshCw className="animate-spin" size={32} style={{ color: 'var(--primary)' }} />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
          {instances.map(instance => {
            const details = getStateDetails(instance.liveStatus?.state);
            return (
              <div 
                key={instance.id}
                className="glass-panel" 
                style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', borderLeft: `4px solid ${details.color}`, cursor: 'pointer', transition: 'transform 0.2s', ':hover': { transform: 'translateY(-2px)' } } as any}
                onClick={() => setSelectedInstance(instance)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'rgba(255, 255, 255, 0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: details.color }}>
                      <Phone size={20} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{instance.name}</h3>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ID: {instance.id}</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Status Ao Vivo:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: details.color }}>{details.label}</span>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: details.color, boxShadow: `0 0 10px ${details.color}` }} />
                  </div>
                </div>
                
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                  Clique para gerenciar (QR Code, Testes, Logout)
                </div>
              </div>
            );
          })}
          {instances.length === 0 && !loading && (
            <div style={{ gridColumn: '1 / -1', padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Nenhuma instância criada. Clique em "Nova Instância" para começar.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
