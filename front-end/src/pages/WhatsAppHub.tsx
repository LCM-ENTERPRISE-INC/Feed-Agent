import React, { useState, useEffect, useRef } from 'react';
import { 
  Phone,
  AlertTriangle, 
  RefreshCw, 
  CheckCircle2, 
  ShieldAlert, 
  Cpu, 
  Sparkles, 
  Clock, 
  BatteryCharging, 
  Smartphone, 
  Signal, 
  LogOut, 
  Activity, 
  Info,
  Send,
  MessageSquare,
  Lock,
  CheckCheck,
  ShieldCheck,
  Zap,
  BookOpen
} from 'lucide-react';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Alert } from '@/components/Alert';
import { useSseGateway } from '@/hooks/useSseGateway';
import type { SseEvent } from '@/hooks/useSseGateway';
import { showToast } from '@/utils/toastHelper';
import apiClient from '@/services/apiClient';

type WaConnectionState = 'open' | 'connecting' | 'close' | 'banned';

interface StabilityLog {
  id: string;
  timestamp: string;
  event: string;
  type: 'info' | 'warn' | 'success';
}

const mockStabilityLogs: StabilityLog[] = [
  { id: '1', timestamp: '13/05/2026 - 19:45', event: 'Sincronização de lote de contatos concluída com sucesso', type: 'success' },
  { id: '2', timestamp: '13/05/2026 - 16:20', event: 'Queda momentânea de sinal da operadora contornada', type: 'warn' },
  { id: '3', timestamp: '13/05/2026 - 14:05', event: 'Handshake inicial estabelecido pelo @whiskeysockets/baileys', type: 'info' },
  { id: '4', timestamp: '13/05/2026 - 09:30', event: 'Bateria do aparelho físico reportada em nível saudável (92%)', type: 'info' },
];

export const WhatsAppHub: React.FC = () => {
  const [waState, setWaState] = useState<WaConnectionState>('connecting');
  const [qrPayload, setQrPayload] = useState<string>('');
  const [lastUpdated, setLastUpdated] = useState<string>('Hoje, 00:36');
  const phoneInstance = 'Canal Principal (5511999990000)';

  // QR Code Expiration Timer (60s)
  const [qrSecondsLeft, setQrSecondsLeft] = useState<number>(60);
  const [qrExpired, setQrExpired] = useState<boolean>(false);
  const timerIntervalRef = useRef<number | null>(null);

  // Modals
  const [showCelebrationModal, setShowCelebrationModal] = useState<boolean>(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState<boolean>(false);
  const [showAntispamManualModal, setShowAntispamManualModal] = useState<boolean>(false);
  const [disconnecting, setDisconnecting] = useState<boolean>(false);

  // Test Message Submittal Widget States
  const [testPhone, setTestPhone] = useState<string>('');
  const [testMessage, setTestMessage] = useState<string>('Olá! Esta é uma mensagem de teste automatizada disparada pelo Feed-Agent via Baileys.');
  const [testSendingState, setTestSendingState] = useState<'idle' | 'typing' | 'sent'>('idle');
  const [lastReceipt, setLastReceipt] = useState<{ id: string; time: string; target: string } | null>(null);

  // Antispam Health & Ban Prevention Module States
  const [msgPerHour, setMsgPerHour] = useState<number>(150);
  const [delaySeconds, setDelaySeconds] = useState<number>(1.5);
  const [checklistItems, setChecklistItems] = useState<{ id: string; label: string; checked: boolean }[]>([
    { id: 'c1', label: 'Rotação automática de instâncias corporativas', checked: true },
    { id: 'c2', label: 'Delay randômico humano ativado no serviço Baileys', checked: true },
    { id: 'c3', label: 'Validação prévia de existência do número no WhatsApp', checked: true },
    { id: 'c4', label: 'Compressão avançada de mídias e anexos pesados', checked: false },
    { id: 'c5', label: 'Aquecimento prévio de chip (Warming age > 14 dias)', checked: true },
  ]);

  // Helper to restart 60s timer
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

  useEffect(() => {
    const fetchInitialStatus = async () => {
      try {
        const res = await apiClient.get('/whatsapp/status');
        if (res.data?.success) {
          const { state, qrCode } = res.data.data;
          setWaState(state);
          if (qrCode) setQrPayload(qrCode);
        }
      } catch (err) {
        console.error('Falha ao obter status do WhatsApp:', err);
      }
    };
    fetchInitialStatus();
  }, []);

  const handleSseEvent = (event: SseEvent) => {
    switch (event.type) {
      case 'connected':
        setWaState('open');
        setLastUpdated(new Date().toLocaleTimeString());
        setShowCelebrationModal(true);
        showToast.success('WhatsApp conectado e autenticado com sucesso!');
        break;
      case 'qr':
        setWaState('connecting');
        if (event.payload?.qrCode) {
          setQrPayload(event.payload.qrCode);
        }
        setLastUpdated(new Date().toLocaleTimeString());
        restartQrTimer();
        break;
      case 'disconnected':
        setWaState('close');
        setQrPayload(''); // Clear stale QR on disconnect
        setLastUpdated(new Date().toLocaleTimeString());
        showToast.info('Conexão do WhatsApp encerrada.');
        break;
      case 'qr:timeout':
        setWaState('connecting');
        setQrExpired(true);
        setQrPayload(''); // Clear expired QR
        setLastUpdated(new Date().toLocaleTimeString());
        break;
      default:
        break;
    }
  };

  const { connectionStatus } = useSseGateway(handleSseEvent);

  // Real API call to request a new QR Code
  const handleRequestNewQr = async () => {
    try {
      showToast.info('Requisitando novo QR Code...');
      // Reset UI immediately to show a "waiting" state
      setQrPayload('');
      setQrExpired(false);
      setWaState('connecting');
      await apiClient.post('/whatsapp/restart');
      // The SSE gateway will push the 'qr' event with the new QR Code image.
    } catch (err) {
      showToast.error('Falha ao requisitar novo QR Code.');
    }
  };

  // Secure Remote Disconnection via API
  const handleConfirmDisconnect = async () => {
    setDisconnecting(true);

    try {
      await apiClient.post('/whatsapp/logout');
      setShowDisconnectModal(false);
      setWaState('close');
      setLastUpdated(new Date().toLocaleTimeString());
      showToast.success('Desconexão remota concluída: Sessão do Baileys encerrada via API.');
    } catch (err) {
      showToast.error('Falha ao tentar desconectar a instância.');
    } finally {
      setDisconnecting(false);
    }
  };

  // International phone mask format helper
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let cleaned = e.target.value.replace(/\D/g, '');
    if (!cleaned.startsWith('55')) {
      cleaned = '55' + cleaned;
    }
    let formatted = '+' + cleaned.substring(0, 2);
    if (cleaned.length > 2) formatted += ' (' + cleaned.substring(2, 4);
    if (cleaned.length > 4) formatted += ') ' + cleaned.substring(4, 9);
    if (cleaned.length > 9) formatted += '-' + cleaned.substring(9, 14);
    setTestPhone(formatted);
  };

  // Test Message Submittal real API
  const handleSendTestMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    const digitsOnly = testPhone.replace(/\D/g, '');
    if (digitsOnly.length < 12) {
      showToast.error('Por favor, insira um número de celular válido com DDD no formato internacional.');
      return;
    }

    if (!testMessage.trim()) {
      showToast.error('A mensagem de teste não pode estar vazia.');
      return;
    }

    setTestSendingState('typing');

    try {
      await apiClient.post('/whatsapp/test-message', {
        phoneNumber: testPhone,
        message: testMessage
      });

      setTestSendingState('sent');
      setLastReceipt({
        id: `WA-TX-${Math.floor(1000 + Math.random() * 9000)}`,
        time: new Date().toLocaleTimeString(),
        target: testPhone,
      });
      showToast.success('Mensagem de teste enviada e confirmada via webhook do Baileys!');

      setTimeout(() => setTestSendingState('idle'), 5000);
    } catch (error) {
      showToast.error('Falha ao enviar mensagem de teste. Verifique a conexão e tente novamente.');
      setTestSendingState('idle');
    }
  };

  const toggleChecklistItem = (id: string) => {
    setChecklistItems(prev => prev.map(item => item.id === id ? { ...item, checked: !item.checked } : item));
  };

  const getStateDetails = (state: WaConnectionState) => {
    switch (state) {
      case 'open':
        return {
          label: 'Conectado (Open)',
          badgeVariant: 'success' as const,
          color: 'var(--success)',
          pulseClass: 'pulse-success',
          description: 'A instância está autenticada, pronta para receber minutas e disparar mensagens em lote.',
        };
      case 'connecting':
        return {
          label: 'Reconectando / Aguardando QR',
          badgeVariant: 'warning' as const,
          color: '#eab308',
          pulseClass: 'pulse-warning',
          description: 'Escaneie o QR Code exibido abaixo com seu celular corporativo para estabelecer o handshake.',
        };
      case 'close':
        return {
          label: 'Desconectado (Close)',
          badgeVariant: 'default' as const,
          color: 'var(--text-muted)',
          pulseClass: 'pulse-default',
          description: 'A sessão ativa foi encerrada pelo aparelho ou expirou por inatividade prolongada.',
        };
      case 'banned':
        return {
          label: 'Instância Banida pelo Provedor',
          badgeVariant: 'error' as const,
          color: 'var(--error)',
          pulseClass: 'pulse-error',
          description: 'O número associado a esta instância sofreu moderação ou restrição pelo WhatsApp.',
        };
    }
  };

  const currentDetails = getStateDetails(waState);

  // Dynamic Antispam Risk Level Evaluation
  const calculateRiskLevel = () => {
    if (msgPerHour > 250 || delaySeconds < 1.0) {
      return {
        level: 'CRÍTICO (Alto Risco)',
        badgeVariant: 'error' as const,
        color: 'var(--error)',
        bg: 'rgba(239, 68, 68, 0.1)',
        recommendation: 'A taxa de disparos é excessiva. Aumente o delay para no mínimo 3s para evitar banimento imediato por heurísticas de IA do Meta.',
      };
    } else if (msgPerHour > 160 || delaySeconds < 2.5) {
      return {
        level: 'MODERADO (Atenção Recomendada)',
        badgeVariant: 'warning' as const,
        color: '#eab308',
        bg: 'rgba(234, 179, 8, 0.1)',
        recommendation: 'Volume limítrofe detectado. Recomendamos espaçar envios ativando o delay randômico humano entre 2s e 5s.',
      };
    } else {
      return {
        level: 'SEGURO (Baixo Risco)',
        badgeVariant: 'success' as const,
        color: 'var(--success)',
        bg: 'rgba(16, 185, 129, 0.1)',
        recommendation: 'Parâmetros perfeitamente sintonizados para tráfego orgânico. O pipeline está operando com risco mínimo de restrição.',
      };
    }
  };

  const currentRisk = calculateRiskLevel();
  const progressPercent = (qrSecondsLeft / 60) * 100;
  const progressColor = qrSecondsLeft > 30 ? 'var(--success)' : qrSecondsLeft > 15 ? '#eab308' : 'var(--error)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* Celebration Splash Screen Modal */}
      {showCelebrationModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
          animation: 'fade-in 0.3s ease-out',
        }}>
          <div className="glass-panel" style={{
            maxWidth: '500px', width: '100%', padding: '48px', display: 'flex', flexDirection: 'column',
            alignItems: 'center', textAlign: 'center', gap: '24px', border: '1px solid rgba(16, 185, 129, 0.4)',
            boxShadow: '0 0 80px rgba(16, 185, 129, 0.2), inset 0 1px 2px rgba(255, 255, 255, 0.2)',
          }}>
            <div style={{ width: '96px', height: '96px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 30px rgba(16, 185, 129, 0.3)', animation: 'bounce 1s ease' }}>
              <CheckCircle2 size={56} style={{ animation: 'scale-up 0.5s ease' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
                <Sparkles size={20} style={{ color: '#eab308' }} />
                <h2 style={{ fontSize: '1.85rem', fontWeight: 700, color: 'white' }}>Conexão Estabelecida!</h2>
                <Sparkles size={20} style={{ color: '#eab308' }} />
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '1rem', lineHeight: 1.5 }}>
                O pareamento com a instância corporativa foi realizado com sucesso. Todos os serviços de mensageria em lote e filas de minutas estão operantes e prontos para envio.
              </p>
            </div>
            <Button type="button" variant="primary" onClick={() => setShowCelebrationModal(false)} style={{ width: '100%', height: '50px', fontSize: '1rem', marginTop: '12px' }}>
              Acessar Central de Disparos
            </Button>
          </div>
        </div>
      )}

      {/* Danger Disconnect Confirmation Modal */}
      {showDisconnectModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
          animation: 'fade-in 0.2s ease-out',
        }}>
          <div className="glass-panel" style={{
            maxWidth: '460px', width: '100%', padding: '36px', display: 'flex', flexDirection: 'column',
            alignItems: 'center', textAlign: 'center', gap: '24px', border: '1px solid rgba(239, 68, 68, 0.4)', boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={32} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'white' }}>Desconectar Instância?</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '8px', lineHeight: 1.5 }}>
                Tem certeza que deseja solicitar o logout remoto do aparelho pareado? Isto invalidará a sessão do Baileys e interromperá todos os disparos de minutas ativos na fila.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '8px' }}>
              <button type="button" onClick={() => setShowDisconnectModal(false)} disabled={disconnecting} style={{ flex: 1, height: '46px', borderRadius: '10px', border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'white', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', transition: 'background-color 0.2s' }}>
                Cancelar Sair
              </button>
              <button type="button" onClick={handleConfirmDisconnect} disabled={disconnecting} style={{ flex: 1, height: '46px', borderRadius: '10px', border: 'none', backgroundColor: 'var(--error)', color: 'white', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 0 20px rgba(239, 68, 68, 0.4)' }}>
                {disconnecting ? <RefreshCw size={16} className="animate-spin" /> : <LogOut size={16} />}
                <span>{disconnecting ? 'Desconectando...' : 'Sim, Desconectar'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Corporativo de Boas Práticas Modal */}
      {showAntispamManualModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
          animation: 'fade-in 0.2s ease-out',
        }}>
          <div className="glass-panel" style={{
            maxWidth: '680px', width: '100%', maxHeight: '85vh', overflowY: 'auto', padding: '44px',
            display: 'flex', flexDirection: 'column', gap: '28px', border: '1px solid rgba(99, 102, 241, 0.4)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <BookOpen size={28} style={{ color: 'var(--primary)' }} />
                <h3 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'white' }}>Manual Corporativo Antispam</h3>
              </div>
              <button onClick={() => setShowAntispamManualModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.6 }}>
              <div>
                <h4 style={{ color: 'white', fontWeight: 700, marginBottom: '6px' }}>1. Algoritmos de Moderação Meta / WhatsApp</h4>
                <p>O WhatsApp utiliza heurísticas baseadas em aprendizado de máquina para analisar padrões de tráfego. Picos repentinos de disparos a partir de números novos ou sem interação prévia ativam o bloqueio automático da instância.</p>
              </div>

              <div>
                <h4 style={{ color: 'white', fontWeight: 700, marginBottom: '6px' }}>2. Importância do Delay Humano Randômico</h4>
                <p>Nunca configure delays estáticos exatos (ex: 1.0s). O motor Baileys do Feed-Agent oferece variação randômica simulando o tempo que um ser humano levaria para compor e enviar pacotes.</p>
              </div>

              <div>
                <h4 style={{ color: 'white', fontWeight: 700, marginBottom: '6px' }}>3. Aquecimento de Conta (*Warming Up*)</h4>
                <p>Números com menos de 14 dias de ativação devem manter uma cota máxima de 50 mensagens/dia, crescendo gradualmente 15% a cada 24 horas. Certifique-se de que o chip receba respostas de usuários reais para elevar a pontuação de reputação.</p>
              </div>

              <div>
                <h4 style={{ color: 'white', fontWeight: 700, marginBottom: '6px' }}>4. Tratamento de Erros e Bounce Rates</h4>
                <p>O envio contínuo para números inexistentes (*bounces*) sinaliza para a rede que a sua lista foi comprada ou raspada. Utilize o checklist de sanitização do painel para podar contatos inválidos.</p>
              </div>
            </div>

            <Button type="button" variant="primary" onClick={() => setShowAntispamManualModal(false)} style={{ width: '100%', height: '48px' }}>
              Entendi e Aplicarei as Diretrizes
            </Button>
          </div>
        </div>
      )}

      {/* Title Header */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: '6px', borderBottom: '1px solid var(--border)', paddingBottom: '20px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em' }}>
              Gerenciador de Conexão WhatsApp
            </h1>
            <p style={{ color: 'var(--text-muted)' }}>
              Monitore o status do serviço Baileys, gerencie o pareamento e inspecione os diagnósticos do aparelho
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Badge variant={connectionStatus === 'connected' ? 'success' : 'warning'}>
              SSE Gateway: {connectionStatus}
            </Badge>
          </div>
        </div>
      </div>

      {/* Extreme Ban Warning Alert */}
      {waState === 'banned' && (
        <div style={{ animation: 'shake 0.5s ease', padding: '4px', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: '12px' }}>
          <Alert variant="error">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.2rem', fontWeight: 700 }}>
                <AlertTriangle size={24} style={{ color: 'var(--error)' }} />
                <span>ALERTA CRÍTICO: INSTÂNCIA DO WHATSAPP BANIDA</span>
              </div>
              <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)' }}>
                Identificamos que o provedor aplicou restrições severas ao número cadastrado. Recomenda-se interromper o envio de filas imediatamente e acionar o suporte de desbloqueio corporativo.
              </p>
            </div>
          </Alert>
        </div>
      )}

      {/* Main Status Panel Grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '32px', alignItems: 'start',
      }}>
        {/* Core Connection Card */}
        <div className="glass-panel" style={{ padding: '36px', display: 'flex', flexDirection: 'column', gap: '28px', position: 'relative', overflow: 'hidden', borderLeft: `4px solid ${currentDetails.color}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: 'rgba(255, 255, 255, 0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: currentDetails.color }}>
                <Phone size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Status da Instância</h3>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{phoneInstance}</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: currentDetails.color }}>{currentDetails.label}</span>
              <div style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: currentDetails.color, boxShadow: `0 0 15px ${currentDetails.color}`, animation: 'pulse 1.5s infinite' }} />
            </div>
          </div>
          <div style={{ padding: '16px', borderRadius: '10px', backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border)' }}>
            <p style={{ fontSize: '0.9rem', lineHeight: 1.5, color: 'var(--text-muted)' }}>{currentDetails.description}</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}><span style={{ color: 'var(--text-muted)' }}>Motor Backend:</span><span style={{ fontWeight: 600 }}>@whiskeysockets/baileys v6.7.0</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}><span style={{ color: 'var(--text-muted)' }}>Porta de Comunicação:</span><span style={{ fontWeight: 600, fontFamily: 'monospace' }}>3001</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Último Evento Recebido:</span><span style={{ fontWeight: 600 }}>{lastUpdated}</span></div>
          </div>
          {waState === 'open' && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '4px' }}>
              <Button type="button" variant="secondary" icon={LogOut} onClick={() => setShowDisconnectModal(true)} style={{ width: '100%', borderColor: 'rgba(239, 68, 68, 0.3)', color: 'var(--error)' }}>
                Desconectar Aparelho Físico (Logout)
              </Button>
            </div>
          )}
        </div>

        {/* QR Code Handshake */}
        <div className="glass-panel" style={{ padding: '36px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '24px' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Handshake & QR Code</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>{waState === 'open' ? 'Conexão ativa e segura. Nenhum QR Code adicional necessário.' : 'Aponte o leitor do WhatsApp Corporativo para parear a sessão'}</p>
          </div>
          <div style={{ padding: '28px', backgroundColor: waState === 'open' ? 'rgba(16, 185, 129, 0.05)' : (qrPayload.startsWith('data:image') ? 'white' : 'rgba(15, 23, 42, 0.5)'), borderRadius: '20px', boxShadow: 'var(--shadow-lg)', border: `4px solid ${waState === 'open' ? 'var(--success)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '240px', height: '240px', position: 'relative', overflow: 'hidden' }}>
            {waState === 'open' ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: 'var(--success)' }}><CheckCircle2 size={72} /><span style={{ fontSize: '1.1rem', fontWeight: 700 }}>Pareado com Sucesso</span></div>
            ) : waState === 'banned' ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: 'var(--error)' }}><ShieldAlert size={72} /><span style={{ fontSize: '1.1rem', fontWeight: 700 }}>Sessão Interrompida</span></div>
            ) : (
              <>
                {qrPayload.startsWith('data:image') ? (
                  <img
                    src={qrPayload}
                    alt="WhatsApp QR"
                    style={{ width: '100%', height: '100%', objectFit: 'contain', filter: qrExpired ? 'blur(8px)' : 'none', transition: 'filter 0.3s ease', animation: 'fade-in 0.4s ease-out' }}
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: '#94a3b8' }}>
                    <RefreshCw size={56} className="animate-spin" style={{ color: 'var(--primary)', opacity: 0.7 }} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>Aguardando QR...</span>
                  </div>
                )}
                {qrExpired && (
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255, 255, 255, 0.9)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#0f172a', padding: '16px' }}>
                    <Clock size={36} style={{ color: 'var(--error)' }} />
                    <span style={{ fontSize: '1rem', fontWeight: 700 }}>QR Code Expirado</span>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Por segurança, gere um novo código</span>
                  </div>
                )}
              </>
            )}
          </div>
          {waState === 'connecting' && (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '0.85rem' }}><span style={{ color: 'var(--text-muted)' }}>Validade do Código:</span><span style={{ fontWeight: 600, color: progressColor, fontFamily: 'monospace' }}>{qrExpired ? '0s (Expirado)' : `${qrSecondsLeft}s restantes`}</span></div>
              <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px', overflow: 'hidden' }}><div style={{ width: `${progressPercent}%`, height: '100%', backgroundColor: progressColor, transition: 'width 1s linear, background-color 0.3s ease' }} /></div>
            </div>
          )}
          <Button type="button" variant="secondary" icon={RefreshCw} onClick={handleRequestNewQr} style={{ width: '100%', marginTop: '8px' }}>{qrExpired ? 'Gerar Novo QR Code Agora' : 'Requisitar Novo QR Code'}</Button>
        </div>
      </div>

      {/* Advanced Antispam Health Module Grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '32px', alignItems: 'start',
      }}>
        {/* Antispam Health Sanity Checklist Card */}
        <div className="glass-panel" style={{ padding: '36px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldCheck size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Saúde Antispam & Sanidade</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Checklist interativo de prevenção contra bloqueios</p>
              </div>
            </div>

            <Button type="button" variant="secondary" icon={BookOpen} onClick={() => setShowAntispamManualModal(true)} style={{ fontSize: '0.8rem', height: '36px', padding: '0 12px' }}>
              Ver Manual
            </Button>
          </div>

          <div style={{ padding: '20px', borderRadius: '12px', backgroundColor: currentRisk.bg, border: `1px solid ${currentRisk.color}`, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700, color: currentRisk.color, fontSize: '1.1rem' }}>
              <Zap size={20} />
              <span>Risco Atual: {currentRisk.level}</span>
            </div>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              {currentRisk.recommendation}
            </p>
          </div>

          {/* Interactive Parameters Sliders */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px', borderRadius: '12px', backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Volume de Disparos / Hora:</span>
                <span style={{ fontWeight: 700, fontFamily: 'monospace', color: msgPerHour > 250 ? 'var(--error)' : msgPerHour > 160 ? '#eab308' : 'var(--success)' }}>{msgPerHour} msg/h</span>
              </div>
              <input
                type="range"
                min={50}
                max={400}
                step={10}
                value={msgPerHour}
                onChange={(e) => setMsgPerHour(Number(e.target.value))}
                style={{ width: '100%', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <span>50 (Seguro)</span>
                <span>200 (Alerta)</span>
                <span>400 (Crítico)</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Tempo de Delay Entre Lotes:</span>
                <span style={{ fontWeight: 700, fontFamily: 'monospace', color: delaySeconds < 1.0 ? 'var(--error)' : delaySeconds < 2.5 ? '#eab308' : 'var(--success)' }}>{delaySeconds}s</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={6.0}
                step={0.5}
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(Number(e.target.value))}
                style={{ width: '100%', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <span>0.5s (Crítico)</span>
                <span>2.5s (Recomendado)</span>
                <span>6.0s (Super Seguro)</span>
              </div>
            </div>
          </div>

          {/* Interactive Best Practices Checklist */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'white' }}>Verificações Ativas no Pipeline:</span>
            {checklistItems.map(item => (
              <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '8px', backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border)', cursor: 'pointer', transition: 'background-color 0.2s' }}>
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={() => toggleChecklistItem(item.id)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.9rem', color: item.checked ? 'white' : 'var(--text-muted)', textDecoration: item.checked ? 'none' : 'line-through' }}>
                  {item.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Direct Test Message Submittal Widget Card */}
        <div className="glass-panel" style={{ padding: '36px', display: 'flex', flexDirection: 'column', gap: '24px', position: 'relative' }}>
          {waState !== 'open' && (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', borderRadius: '24px', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px', textAlign: 'center', gap: '16px' }}>
              <Lock size={36} style={{ color: 'var(--text-muted)' }} />
              <div><h4 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'white' }}>Widget Bloqueado</h4><p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '6px', lineHeight: 1.5 }}>É necessário estar conectado (Open) para disparar mensagens de teste na rede do WhatsApp.</p></div>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MessageSquare size={20} /></div>
            <div><h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Disparo de Teste Rápido</h3><p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Valide a latência e o envio antes dos lotes</p></div>
          </div>
          <form onSubmit={handleSendTestMessage} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Número de Destino (Com DDD)</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input type="text" placeholder="+55 (11) 99999-0001" value={testPhone} onChange={handlePhoneChange} disabled={testSendingState !== 'idle'} style={{ width: '100%', height: '46px', backgroundColor: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0 16px 0 44px', color: 'white', fontFamily: 'monospace', fontSize: '0.95rem' }} />
                <Phone size={18} style={{ position: 'absolute', left: '16px', color: 'var(--text-muted)' }} />
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Formato internacional gerado automaticamente a partir de 55</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Conteúdo da Mensagem</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button type="button" onClick={() => setTestMessage('👋 Olá! Disparo de teste bem-sucedido via Feed-Agent Baileys.')} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '0.7rem', padding: '2px 6px', color: 'var(--text-muted)', cursor: 'pointer' }}>Saudação</button>
                  <button type="button" onClick={() => setTestMessage('🚀 Alerta de Latência: Verificando tempo de resposta do Baileys Hub.')} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '0.7rem', padding: '2px 6px', color: 'var(--text-muted)', cursor: 'pointer' }}>Latência</button>
                </div>
              </div>
              <textarea rows={3} placeholder="Digite a mensagem de teste..." value={testMessage} onChange={(e) => setTestMessage(e.target.value)} disabled={testSendingState !== 'idle'} style={{ width: '100%', backgroundColor: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 16px', color: 'white', fontFamily: 'var(--font-sans)', fontSize: '0.9rem', resize: 'none', lineHeight: 1.4 }} />
            </div>
            {testSendingState === 'typing' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderRadius: '8px', backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#3b82f6', fontSize: '0.85rem', fontWeight: 600, animation: 'pulse 1s infinite' }}><RefreshCw size={16} className="animate-spin" /><span>Simulando digitação humana no WhatsApp (composing)...</span></div>
            )}
            {testSendingState === 'sent' && lastReceipt && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '14px 16px', borderRadius: '8px', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: 'var(--success)', animation: 'fade-in 0.3s ease-out' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.9rem' }}><CheckCheck size={18} /><span>Recibo: Entregue e Lido com Sucesso!</span></div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}><span>Transação: {lastReceipt.id}</span><span>{lastReceipt.time}</span></div>
              </div>
            )}
            <Button type="submit" variant="primary" icon={Send} isLoading={testSendingState === 'typing'} style={{ width: '100%', height: '46px', fontSize: '0.95rem' }}>Enviar Mensagem Agora</Button>
          </form>
        </div>
      </div>

      {/* Diagnostics Metrics & Stability Logs Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '32px', alignItems: 'start' }}>
        <div className="glass-panel" style={{ padding: '36px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Smartphone size={20} /></div><div><h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Diagnóstico do Aparelho Físico</h3><p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Métricas telemetrizadas do celular pareado</p></div></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderRadius: '10px', backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border)' }}><div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)' }}><Smartphone size={18} /><span>Modelo & Fabricante:</span></div><span style={{ fontWeight: 600 }}>iPhone 14 Pro Max (Apple)</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderRadius: '10px', backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border)' }}><div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)' }}><Info size={18} /><span>Sistema Operacional:</span></div><span style={{ fontWeight: 600 }}>iOS 17.4.1</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderRadius: '10px', backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border)' }}><div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)' }}><BatteryCharging size={18} style={{ color: 'var(--success)' }} /><span>Bateria & Carregamento:</span></div><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '32px', height: '14px', border: '1px solid var(--success)', borderRadius: '3px', padding: '1px', display: 'flex', alignItems: 'center' }}><div style={{ width: '88%', height: '100%', backgroundColor: 'var(--success)', borderRadius: '1px' }} /></div><span style={{ fontWeight: 700, color: 'var(--success)' }}>88% (Conectado)</span></div></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderRadius: '10px', backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border)' }}><div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)' }}><Signal size={18} style={{ color: '#3b82f6' }} /><span>Qualidade do Sinal:</span></div><span style={{ fontWeight: 600, color: '#3b82f6' }}>Excelente (5G LTE)</span></div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '36px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Activity size={20} /></div><div><h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Estabilidade nas Últimas 24h</h3><p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Registro de eventos e telemetria do serviço Baileys</p></div></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {mockStabilityLogs.map((log) => {
              const badgeColor = log.type === 'success' ? 'success' : log.type === 'warn' ? 'warning' : 'primary';
              return (
                <div key={log.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '14px 16px', borderRadius: '10px', backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><Badge variant={badgeColor}>{log.type.toUpperCase()}</Badge><span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{log.timestamp}</span></div>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{log.event}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Simulator Controls Sandbox Bar */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><Cpu size={18} style={{ color: 'var(--primary)' }} /><h4 style={{ fontSize: '1rem', fontWeight: 700 }}>Controles de Simulação de Estados (Sandbox de Testes)</h4></div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Alterne interativamente entre os estados reativos para testar o comportamento da interface e dos alarmes visuais.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>

        </div>
      </div>

    </div>
  );
};

export default WhatsAppHub;
