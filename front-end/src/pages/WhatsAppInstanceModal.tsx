import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, RefreshCw, CheckCircle2, Clock, LogOut, Send, Lock } from 'lucide-react';
import { Button } from '@/components/Button';
import { ResponsiveModal } from '@/components/ResponsiveModal';
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
  const [connecting, setConnecting] = useState(false);

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

  const handleConnect = async () => {
    try {
      setConnecting(true);
      showToast.info('Conectando...');
      await apiClient.post(`/whatsapp/instances/${instanceId}/connect`);
    } catch {
      showToast.error('Falha ao tentar conectar.');
    } finally {
      setConnecting(false);
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
      await apiClient.post(`/whatsapp/instances/${instanceId}/send-message`, {
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

  const footer = (
    <>
      <div className="connection-modal__actions">
        {waState === 'open' && (
          <Button type="button" variant="danger" icon={LogOut} onClick={handleConfirmDisconnect} disabled={disconnecting}>
            Pausar Conexão
          </Button>
        )}
        {waState === 'close' && (
          <>
            <Button type="button" variant="primary" icon={RefreshCw} onClick={handleConnect} disabled={connecting}>
              Conectar
            </Button>
            <Button type="button" variant="secondary" onClick={handleRequestNewQr}>
              Novo QR
            </Button>
          </>
        )}
        {waState === 'connecting' && (
          <Button type="button" variant="primary" icon={RefreshCw} onClick={handleRequestNewQr}>
            {qrExpired ? 'Gerar novo QR' : 'Atualizar QR'}
          </Button>
        )}
        <Button type="button" variant="secondary" icon={AlertTriangle} onClick={onDelete} className="connection-modal__danger">
          Excluir Instância
        </Button>
      </div>
      <p className="connection-modal__secure">
        <Lock size={12} aria-hidden />
        Seus dados estão protegidos com criptografia de ponta a ponta.
      </p>
    </>
  );

  return (
    <ResponsiveModal
      open
      title="Conectar canal"
      subtitle={instanceName}
      onClose={onClose}
      size="connection"
      labelledById="connection-modal-title"
      footer={footer}
    >
      <div className="connection-modal-content">
        <div className="connection-modal__qr-col">
          <div className={`qr-wrapper${waState === 'open' ? ' qr-wrapper--connected' : ''}`}>
            {waState === 'open' ? (
              <CheckCircle2 size={64} style={{ color: 'var(--success)' }} aria-hidden />
            ) : qrPayload ? (
              <img
                src={qrPayload}
                alt="QR Code para conectar o canal"
                style={{ filter: qrExpired ? 'blur(6px)' : 'none' }}
              />
            ) : (
              <RefreshCw size={40} className="qr-wrapper__spinner" style={{ color: 'var(--primary)' }} aria-hidden />
            )}
            {qrExpired && waState !== 'open' && (
              <div className="qr-wrapper__expired" role="status">
                <Clock size={28} style={{ color: 'var(--error)' }} aria-hidden />
                <strong>QR expirado</strong>
              </div>
            )}
          </div>
          {waState === 'connecting' && !qrExpired && (
            <span className="connection-modal__timer">{qrSecondsLeft}s restantes</span>
          )}
        </div>

        <div className="connection-modal__form-col">
          <div className="connection-modal__status" role="status">
            <strong>{copy.label}</strong>
            <span>{copy.hint}</span>
          </div>

          <h3 className="connection-modal__form-title">Mensagem de teste</h3>
          {waState !== 'open' && (
            <div className="connection-modal__hint">Conecte o canal para enviar uma mensagem de teste.</div>
          )}

          <form
            onSubmit={handleSendTestMessage}
            className="connection-modal__form"
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
            <Button type="submit" variant="primary" icon={Send} isLoading={testSendingState === 'typing'} className="connection-modal__submit">
              Enviar teste
            </Button>
          </form>
        </div>
      </div>
    </ResponsiveModal>
  );
};

export default WhatsAppInstanceModal;
