import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, RefreshCw, CheckCircle2, Clock, LogOut, Send, X, Lock } from 'lucide-react';
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
  if (state === 'open') return { label: 'Canal conectado', hint: 'Pronto para enviar mensagens.' };
  if (state === 'banned') return { label: 'Bloqueado', hint: 'Esta sessão foi barrada pelo serviço de mensagens.' };
  if (expired) return { label: 'QR expirado', hint: 'Gere um novo código e escaneie novamente.' };
  if (state === 'connecting') return { label: 'Aguardando leitura', hint: 'Abra o aplicativo no celular e escaneie o QR.' };
  return { label: 'Canal desconectado', hint: 'Solicite um QR para conectar este canal.' };
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
    document.body.classList.add('modal-open');
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('modal-open');
      window.removeEventListener('keydown', onKey);
    };
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
    <div
      className="ui-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wa-modal-title"
      onClick={onClose}
    >
      <div className="ui-modal ui-modal--sheet" onClick={(e) => e.stopPropagation()}>
        <div className="ui-modal__header">
          <div style={{ minWidth: 0 }}>
            <h2 id="wa-modal-title" className="ui-modal__title truncate">
              Conectar Canal
            </h2>
            <p className="connect-sheet__subtitle truncate" title={instanceName}>
              {instanceName}
            </p>
          </div>
          <button type="button" className="ui-modal__close" onClick={onClose} aria-label="Fechar">
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="ui-modal__body">
          <div className="connect-sheet">
            <div className="connect-sheet__qr">
              <div className={`connect-sheet__qr-box${waState === 'open' ? ' is-connected' : ''}`}>
                {waState === 'open' ? (
                  <CheckCircle2 size={64} style={{ color: 'var(--success)' }} aria-hidden />
                ) : qrPayload ? (
                  <img
                    src={qrPayload}
                    alt="QR Code para conectar o canal"
                    style={{ filter: qrExpired ? 'blur(6px)' : 'none' }}
                  />
                ) : (
                  <RefreshCw size={40} style={{ color: 'var(--primary)', animation: 'spin 0.8s linear infinite' }} aria-hidden />
                )}
                {qrExpired && waState !== 'open' && (
                  <div className="connect-sheet__qr-expired" role="status">
                    <Clock size={28} style={{ color: 'var(--error)' }} aria-hidden />
                    <strong>QR expirado</strong>
                  </div>
                )}
              </div>

              {waState === 'connecting' && !qrExpired && (
                <span className="connect-sheet__timer">{qrSecondsLeft}s restantes</span>
              )}
            </div>

            <div className="connect-sheet__form">
              <div className="connect-sheet__status" role="status">
                <strong>{copy.label}</strong>
                <span>{copy.hint}</span>
              </div>

              <h3 className="connect-sheet__form-title">Mensagem de teste</h3>
              {waState !== 'open' && (
                <div className="connect-sheet__hint">Conecte o canal para enviar uma mensagem de teste.</div>
              )}

              <form
                onSubmit={handleSendTestMessage}
                className="connect-sheet__form-fields"
                style={{
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
                />
                <Button type="submit" variant="primary" icon={Send} isLoading={testSendingState === 'typing'} className="connect-sheet__submit">
                  Enviar teste
                </Button>
              </form>
            </div>
          </div>
        </div>

        <div className="ui-modal__footer">
          <div className="connect-sheet__actions">
            {waState !== 'open' ? (
              <Button type="button" variant="primary" icon={RefreshCw} onClick={handleRequestNewQr}>
                {qrExpired ? 'Gerar novo QR' : 'Atualizar QR'}
              </Button>
            ) : (
              <Button type="button" variant="danger" icon={LogOut} onClick={handleConfirmDisconnect} disabled={disconnecting}>
                Desconectar
              </Button>
            )}
            <Button type="button" variant="secondary" icon={AlertTriangle} onClick={onDelete} className="connect-sheet__danger">
              Excluir Instância
            </Button>
          </div>
          <p className="connect-sheet__secure">
            <Lock size={12} aria-hidden />
            Seus dados estão protegidos com criptografia de ponta a ponta.
          </p>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppInstanceModal;
