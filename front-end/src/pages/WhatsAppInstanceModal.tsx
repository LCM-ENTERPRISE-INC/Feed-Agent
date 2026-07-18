import React, { useState, useEffect, useRef } from 'react';
import { 
  AlertTriangle, RefreshCw, CheckCircle2, ShieldAlert, Clock, LogOut, Send, MessageSquare, Lock, CheckCheck
} from 'lucide-react';
import { Button } from '@/components/Button';
import { useSseGateway, SseEvent } from '@/hooks/useSseGateway';
import { showToast } from '@/utils/toastHelper';
import apiClient from '@/services/apiClient';

interface WhatsAppInstanceModalProps {
  instanceId: number;
  instanceName: string;
  initialWaState: string;
  onClose: () => void;
  onDelete: () => void;
}

type WaConnectionState = 'open' | 'connecting' | 'close' | 'banned' | 'DISCONNECTED';

export const WhatsAppInstanceModal: React.FC<WhatsAppInstanceModalProps> = ({ instanceId, instanceName, initialWaState, onClose, onDelete }) => {
  const [waState, setWaState] = useState<WaConnectionState>(initialWaState.toLowerCase() as WaConnectionState);
  const [qrPayload, setQrPayload] = useState<string>('');
  
  const [qrSecondsLeft, setQrSecondsLeft] = useState<number>(60);
  const [qrExpired, setQrExpired] = useState<boolean>(false);
  const timerIntervalRef = useRef<number | null>(null);
  
  const [disconnecting, setDisconnecting] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('Olá! Teste de instância.');
  const [testSendingState, setTestSendingState] = useState<'idle' | 'typing' | 'sent'>('idle');

  const restartQrTimer = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setQrSecondsLeft(60);
    setQrExpired(false);

    timerIntervalRef.current = window.setInterval(() => {
      setQrSecondsLeft((prev) => {
        if (prev <= 1) {
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
          setQrExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    if (waState === 'connecting') {
      restartQrTimer();
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [waState, qrPayload]);

  const handleSseEvent = (event: SseEvent) => {
    switch (event.type) {
      case 'connected':
        setWaState('open');
        showToast.success(`Instância ${instanceName} conectada!`);
        break;
      case 'qr':
        setWaState('connecting');
        if (event.payload?.qrCode) setQrPayload(event.payload.qrCode);
        restartQrTimer();
        break;
      case 'disconnected':
        setWaState('close');
        setQrPayload('');
        break;
      case 'qr:timeout':
        setWaState('connecting');
        setQrExpired(true);
        setQrPayload('');
        break;
    }
  };

  useSseGateway(instanceId, handleSseEvent);

  const handleRequestNewQr = async () => {
    try {
      showToast.info('Requisitando novo QR Code...');
      setQrPayload('');
      setQrExpired(false);
      setWaState('connecting');
      await apiClient.post(`/whatsapp/instances/${instanceId}/restart`);
    } catch (err) {
      showToast.error('Falha ao requisitar novo QR Code.');
    }
  };

  const handleConfirmDisconnect = async () => {
    setDisconnecting(true);
    try {
      await apiClient.post(`/whatsapp/instances/${instanceId}/logout`);
      setWaState('close');
      showToast.success('Desconexão concluída.');
    } catch (err) {
      showToast.error('Falha ao desconectar.');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSendTestMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone) return;
    
    setTestSendingState('typing');
    try {
      await apiClient.post(`/whatsapp/instances/${instanceId}/test-message`, {
        phoneNumber: testPhone,
        message: testMessage
      });
      setTestSendingState('sent');
      showToast.success('Mensagem de teste enviada!');
      setTimeout(() => setTestSendingState('idle'), 3000);
    } catch (error) {
      showToast.error('Falha ao enviar mensagem de teste.');
      setTestSendingState('idle');
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(16px)',
      zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
    }}>
      <div className="glass-panel" style={{ width: '800px', maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '36px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{instanceName}</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '24px', cursor: 'pointer' }}>&times;</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          
          {/* QR Area */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <div style={{ padding: '28px', backgroundColor: waState === 'open' ? 'rgba(16, 185, 129, 0.05)' : (qrPayload ? 'white' : 'rgba(15, 23, 42, 0.5)'), borderRadius: '20px', border: `4px solid ${waState === 'open' ? 'var(--success)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '240px', height: '240px', position: 'relative', overflow: 'hidden' }}>
              {waState === 'open' ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: 'var(--success)' }}><CheckCircle2 size={72} /></div>
              ) : (
                <>
                  {qrPayload ? (
                    <img src={qrPayload} alt="QR" style={{ width: '100%', height: '100%', filter: qrExpired ? 'blur(8px)' : 'none' }} />
                  ) : (
                    <RefreshCw size={56} className="animate-spin" style={{ color: 'var(--primary)' }} />
                  )}
                  {qrExpired && (
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255, 255, 255, 0.9)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#0f172a' }}>
                      <Clock size={36} style={{ color: 'var(--error)' }} />
                      <span style={{ fontWeight: 700 }}>Expirado</span>
                    </div>
                  )}
                </>
              )}
            </div>
            
            {waState === 'connecting' && !qrExpired && <div>{qrSecondsLeft}s restantes</div>}

            {waState !== 'open' ? (
              <Button type="button" variant="primary" icon={RefreshCw} onClick={handleRequestNewQr} style={{ width: '100%' }}>
                {qrExpired ? 'Gerar Novo QR' : 'Requisitar QR'}
              </Button>
            ) : (
              <Button type="button" variant="danger" icon={LogOut} onClick={handleConfirmDisconnect} disabled={disconnecting} style={{ width: '100%' }}>
                Desconectar
              </Button>
            )}
            
            <Button type="button" variant="secondary" icon={AlertTriangle} onClick={onDelete} style={{ width: '100%', borderColor: 'rgba(239, 68, 68, 0.3)', color: 'var(--error)' }}>
              Deletar Instância
            </Button>
          </div>

          {/* Test Message */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Disparo de Teste</h3>
            {waState !== 'open' && (
              <div style={{ padding: '16px', backgroundColor: 'rgba(15, 23, 42, 0.8)', borderRadius: '12px', color: 'var(--text-muted)' }}>
                É necessário estar conectado (Open) para enviar testes.
              </div>
            )}
            <form onSubmit={handleSendTestMessage} style={{ display: 'flex', flexDirection: 'column', gap: '12px', opacity: waState === 'open' ? 1 : 0.5, pointerEvents: waState === 'open' ? 'auto' : 'none' }}>
              <input type="text" placeholder="5511999990000" value={testPhone} onChange={e => setTestPhone(e.target.value)} style={{ width: '100%', height: '46px', backgroundColor: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0 16px', color: 'white' }} />
              <textarea rows={3} value={testMessage} onChange={e => setTestMessage(e.target.value)} style={{ width: '100%', backgroundColor: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 16px', color: 'white' }} />
              <Button type="submit" variant="primary" icon={Send} isLoading={testSendingState === 'typing'}>Enviar Teste</Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
