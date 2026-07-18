import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, RefreshCw, CheckCircle2, Clock, LogOut, Send, X } from 'lucide-react';
import { Button } from '@/components/Button';
import { useSseGateway } from '@/hooks/useSseGateway';
import type { SseEvent } from '@/hooks/useSseGateway';
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

const statusCopy = (state: WaConnectionState, expired: boolean) => {
  if (state === 'open') return { label: 'Conectado', hint: 'Pronto para enviar mensagens.' };
  if (state === 'banned') return { label: 'Bloqueado', hint: 'Esta sessão foi barrada pelo WhatsApp.' };
  if (expired) return { label: 'QR expirado', hint: 'Gere um novo código e escaneie novamente.' };
  if (state === 'connecting') return { label: 'Aguardando leitura', hint: 'Abra o WhatsApp no celular e escaneie o QR.' };
  return { label: 'Desconectado', hint: 'Solicite um QR para conectar este aparelho.' };
};

export const WhatsAppInstanceModal: React.FC<WhatsAppInstanceModalProps> = ({
  instanceId,
  instanceName,
  initialWaState,
  onClose,
  onDelete,
}) => {
  const [waState, setWaState] = useState<WaConnectionState>(initialWaState.toLowerCase() as WaConnectionState);
  const [qrPayload, setQrPayload] = useState('');
  const [qrSecondsLeft, setQrSecondsLeft] = useState(60);
  const [qrExpired, setQrExpired] = useState(false);
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
    if (waState !== 'connecting') {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      return;
    }
    const boot = window.setTimeout(() => restartQrTimer(), 0);
    return () => {
      window.clearTimeout(boot);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [waState, qrPayload]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSseEvent = (event: SseEvent) => {
    switch (event.type) {
      case 'connected':
        setWaState('open');
        showToast.success(`Instância ${instanceName} conectada!`);
        break;
      case 'qr':
        setWaState('connecting');
        {
          const payload = event.payload as { qrCode?: string } | null;
          if (payload?.qrCode) setQrPayload(payload.qrCode);
        }
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
        showToast.error('O QR expirou. Gere um novo código para continuar.');
        break;
    }
  };

  useSseGateway(instanceId, handleSseEvent);

  const handleRequestNewQr = async () => {
    try {
      showToast.info('Gerando novo QR Code…');
      setQrPayload('');
      setQrExpired(false);
      setWaState('connecting');
      await apiClient.post(`/whatsapp/instances/${instanceId}/restart`);
    } catch {
      showToast.error('Não foi possível gerar um novo QR. Tente novamente.');
    }
  };

  const handleConfirmDisconnect = async () => {
    setDisconnecting(true);
    try {
      await apiClient.post(`/whatsapp/instances/${instanceId}/logout`);
      setWaState('close');
      showToast.success('Desconectado.');
    } catch {
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
        message: testMessage,
      });
      setTestSendingState('sent');
      showToast.success('Mensagem de teste enviada!');
      setTimeout(() => setTestSendingState('idle'), 3000);
    } catch {
      showToast.error('Falha ao enviar mensagem de teste.');
      setTestSendingState('idle');
    }
  };

  const copy = statusCopy(waState, qrExpired);

  return (
    <div className="ui-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="wa-modal-title" onClick={onClose}>
      <div className="ui-modal ui-modal--lg" onClick={(e) => e.stopPropagation()}>
        <div className="ui-modal__header">
          <div style={{ minWidth: 0 }}>
            <h2 id="wa-modal-title" className="ui-modal__title truncate" title={instanceName}>
              {instanceName}
            </h2>
            <p style={{ fontSize: '0.85rem', marginTop: 4 }}>
              <strong>{copy.label}</strong> — {copy.hint}
            </p>
          </div>
          <button type="button" className="btn btn-ghost" onClick={onClose} aria-label="Fechar">
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="ui-modal__body">
          <div className="split-pane">
            <div className="qr-frame">
              <div
                style={{
                  padding: 16,
                  backgroundColor: waState === 'open' ? 'color-mix(in srgb, var(--success) 8%, transparent)' : 'var(--surface)',
                  borderRadius: 16,
                  border: `3px solid ${waState === 'open' ? 'var(--success)' : 'var(--border)'}`,
                  width: 'min(240px, 70vw)',
                  aspectRatio: '1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {waState === 'open' ? (
                  <CheckCircle2 size={64} style={{ color: 'var(--success)' }} aria-hidden />
                ) : qrPayload ? (
                  <img
                    src={qrPayload}
                    alt="QR Code para conectar o WhatsApp"
                    style={{ width: '100%', height: '100%', objectFit: 'contain', filter: qrExpired ? 'blur(6px)' : 'none' }}
                  />
                ) : (
                  <RefreshCw size={40} style={{ color: 'var(--primary)', animation: 'spin 0.8s linear infinite' }} aria-hidden />
                )}
                {qrExpired && waState !== 'open' && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(255,255,255,0.92)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      color: '#0f172a',
                    }}
                  >
                    <Clock size={28} style={{ color: 'var(--error)' }} aria-hidden />
                    <strong>QR expirado</strong>
                  </div>
                )}
              </div>

              {waState === 'connecting' && !qrExpired && (
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{qrSecondsLeft}s restantes</span>
              )}

              <div className="stack-actions" style={{ width: '100%', flexDirection: 'column' }}>
                {waState !== 'open' ? (
                  <Button type="button" variant="primary" icon={RefreshCw} onClick={handleRequestNewQr} style={{ width: '100%' }}>
                    {qrExpired ? 'Gerar novo QR' : 'Atualizar QR'}
                  </Button>
                ) : (
                  <Button type="button" variant="danger" icon={LogOut} onClick={handleConfirmDisconnect} disabled={disconnecting} style={{ width: '100%' }}>
                    Desconectar
                  </Button>
                )}
                <Button type="button" variant="secondary" icon={AlertTriangle} onClick={onDelete} style={{ width: '100%', color: 'var(--error)' }}>
                  Excluir instância
                </Button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Mensagem de teste</h3>
              {waState !== 'open' && (
                <div className="glass-panel" style={{ padding: 14, fontSize: '0.9rem' }}>
                  Conecte o aparelho (status Conectado) para enviar um teste.
                </div>
              )}
              <form
                onSubmit={handleSendTestMessage}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  opacity: waState === 'open' ? 1 : 0.55,
                  pointerEvents: waState === 'open' ? 'auto' : 'none',
                }}
              >
                <label className="input-label" htmlFor="test-phone">
                  Telefone (com DDI)
                </label>
                <input
                  id="test-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="5511999990000"
                  className="form-input"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                />
                <label className="input-label" htmlFor="test-msg">
                  Mensagem
                </label>
                <textarea
                  id="test-msg"
                  rows={3}
                  className="form-input"
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  style={{ resize: 'vertical', minHeight: 80 }}
                />
                <Button type="submit" variant="primary" icon={Send} isLoading={testSendingState === 'typing'}>
                  Enviar teste
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppInstanceModal;
