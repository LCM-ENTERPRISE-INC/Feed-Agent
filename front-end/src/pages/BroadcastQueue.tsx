import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  RefreshCw,
  Send,
  Play,
  Pause,
  Clock,
  AlertCircle,
  Sliders,
  Layers,
  Server,
  Activity,
  ShieldAlert,
  FastForward,
  Ban,
  TrendingUp,
  History,
} from 'lucide-react';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { showToast } from '@/utils/toastHelper';
import apiClient from '@/services/apiClient';

type CampaignStatus =
  | 'DRAFT'
  | 'PREPARING'
  | 'QUEUE_FAILED'
  | 'QUEUED'
  | 'RUNNING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'PARTIAL_FAILED'
  | 'FAILED'
  | 'CANCELLED';

interface AudiencePreview {
  totalContacts: number;
  activeContacts: number;
  eligibleContacts: number;
  invalidContacts: number;
  excludedContacts: number;
  alreadySentContacts: number;
  inactiveContacts: number;
  batchSize: number;
  estimatedBatches: number;
}

interface CampaignProgress {
  campaignId: string;
  batchId: string;
  title: string;
  status: CampaignStatus;
  expectedRecipients: number;
  materializedRecipients: number;
  queuedJobs: number;
  progressPercent: number;
  delayMs: number;
  batchSize: number;
  counters: {
    queued: number;
    active: number;
    sent: number;
    failed: number;
    skipped: number;
    cancelled: number;
    pending: number;
    processed: number;
    total: number;
  };
  errorMessage?: string | null;
}

interface QueueJob {
  id: string;
  recipientName: string;
  recipientPhone: string;
  status: string;
  attempts: number;
  error?: string;
}

interface HistoricalBatch {
  id: string;
  date: string;
  title: string;
  totalContacts: number;
  successRate: string;
  deliveredCount: number;
  duration: string;
  status: string;
}

interface SseLogItem {
  id: string;
  timestamp: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  message: string;
}

function statusLabel(status?: CampaignStatus | string | null): string {
  switch (status) {
    case 'RUNNING':
      return 'TRANSMITINDO';
    case 'QUEUED':
      return 'NA FILA';
    case 'PREPARING':
      return 'PREPARANDO';
    case 'PAUSED':
      return 'PAUSADA';
    case 'COMPLETED':
      return 'CONCLUÍDA';
    case 'PARTIAL_FAILED':
      return 'PARCIAL';
    case 'FAILED':
    case 'QUEUE_FAILED':
      return 'FALHOU';
    case 'CANCELLED':
      return 'CANCELADA';
    default:
      return 'OCIOSA';
  }
}

function authToken(): string | null {
  return (
    localStorage.getItem('feedagent-session') ||
    localStorage.getItem('feedagent-token') ||
    localStorage.getItem('token') ||
    null
  );
}

export const BroadcastQueue: React.FC = () => {
  const [delaySeconds, setDelaySeconds] = useState(3.5);
  const [selectionMode, setSelectionMode] = useState<'all' | 'specific'>('all');
  const [preview, setPreview] = useState<AudiencePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [progress, setProgress] = useState<CampaignProgress | null>(null);
  const [jobs, setJobs] = useState<QueueJob[]>([]);
  const [historicalBatches, setHistoricalBatches] = useState<HistoricalBatch[]>([]);
  const [monthLabel, setMonthLabel] = useState(
    new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
  );
  const [isLaunchingBatch, setIsLaunchingBatch] = useState(false);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<SseLogItem[]>([]);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [showExclusionDetails, setShowExclusionDetails] = useState(false);
  const terminalBottomRef = useRef<HTMLDivElement | null>(null);
  const pollRef = useRef<number | null>(null);

  const pushLog = useCallback((type: SseLogItem['type'], message: string) => {
    setLogs((prev) => [
      ...prev.slice(-200),
      {
        id: `${Date.now()}-${Math.random()}`,
        timestamp: new Date().toLocaleTimeString('pt-BR'),
        type,
        message,
      },
    ]);
  }, []);

  const loadPreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const res = await apiClient.post('/campaigns/audience-preview', {
        selectionMode: 'all',
        skipAlreadySent: true,
      });
      if (res.data?.success) setPreview(res.data.data);
    } catch (err) {
      showToast.error(`Erro na prévia de audiência: ${(err as Error).message}`);
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const res = await apiClient.get('/campaigns/history?page=1&limit=20');
      if (res.data?.success) {
        setHistoricalBatches(res.data.data.data || []);
        if (res.data.data.monthLabel) setMonthLabel(res.data.data.monthLabel);
      }
    } catch {
      showToast.error('Erro ao buscar histórico de campanhas.');
    }
  }, []);

  const loadActive = useCallback(async () => {
    try {
      const res = await apiClient.get('/campaigns/active');
      if (res.data?.success && res.data.data) {
        setProgress(res.data.data);
        return res.data.data as CampaignProgress;
      }
      setProgress(null);
      return null;
    } catch {
      return null;
    }
  }, []);

  const loadJobs = useCallback(async (campaignId: string) => {
    try {
      const res = await apiClient.get(`/campaigns/${campaignId}/jobs?page=1&limit=50`);
      if (res.data?.success) setJobs(res.data.data.data || []);
    } catch {
      /* ignore transient */
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadPreview(), loadHistory()]);
      const active = await loadActive();
      if (active?.campaignId) await loadJobs(active.campaignId);
    } finally {
      setLoading(false);
    }
  }, [loadActive, loadHistory, loadJobs, loadPreview]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  // Poll progress while campaign is active
  useEffect(() => {
    if (!progress?.campaignId) return;
    const active =
      progress.status === 'QUEUED' ||
      progress.status === 'RUNNING' ||
      progress.status === 'PREPARING' ||
      progress.status === 'PAUSED';
    if (!active) return;

    pollRef.current = window.setInterval(() => {
      void (async () => {
        try {
          const res = await apiClient.get(`/campaigns/${progress.campaignId}/progress`);
          if (res.data?.success) {
            setProgress(res.data.data);
            await loadJobs(progress.campaignId);
          }
        } catch {
          /* ignore */
        }
      })();
    }, 4000);

    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [progress?.campaignId, progress?.status, loadJobs]);

  // SSE reconnect + snapshot
  useEffect(() => {
    const token = authToken();
    if (!token) return;

    const base = apiClient.defaults.baseURL || '/api';
    const url = `${base}/campaigns/events?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);

    es.addEventListener('snapshot', (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data);
        if (data) {
          setProgress(data);
          pushLog('INFO', `Snapshot: campanha ${data.campaignId} (${data.status})`);
        } else {
          pushLog('INFO', 'Nenhuma campanha ativa no snapshot SSE.');
        }
      } catch {
        /* ignore */
      }
    });

    const forward = (type: string) => (ev: Event) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data);
        pushLog('INFO', `${type}: ${data.campaignId || ''}`);
        if (data.campaignId) {
          void apiClient.get(`/campaigns/${data.campaignId}/progress`).then((res) => {
            if (res.data?.success) setProgress(res.data.data);
          });
        }
      } catch {
        /* ignore */
      }
    };

    [
      'campaign.preparing',
      'campaign.queued',
      'campaign.running',
      'campaign.paused',
      'campaign.resumed',
      'campaign.cancelled',
      'campaign.finished',
      'campaign.recipient',
      'campaign.queue_failed',
    ].forEach((t) => es.addEventListener(t, forward(t)));

    es.onerror = () => {
      pushLog('WARNING', 'SSE desconectado — tentará reconectar automaticamente.');
    };

    return () => es.close();
  }, [pushLog]);

  useEffect(() => {
    terminalBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const eligible = preview?.eligibleContacts ?? 0;
  const totalEstimatedSeconds = (eligible || 1) * delaySeconds;
  const estimatedMinutes = Math.floor(totalEstimatedSeconds / 60);
  const estimatedRemainderSeconds = Math.round(totalEstimatedSeconds % 60);

  const counters = progress?.counters;
  const queuedCount = counters?.queued ?? 0;
  const processingCount = counters?.active ?? 0;
  const completedCount = counters?.sent ?? 0;
  const failedCount = counters?.failed ?? 0;
  const progressPercentage = progress?.progressPercent ?? 0;
  const totalTrackableJobs = counters?.total ?? 0;
  const processedJobsCount = counters?.processed ?? 0;

  const beltStatus = statusLabel(progress?.status);
  const isPaused = progress?.status === 'PAUSED';
  const canPause = progress?.status === 'QUEUED' || progress?.status === 'RUNNING';
  const canResume = progress?.status === 'PAUSED';
  const canCancel =
    progress &&
    !['COMPLETED', 'CANCELLED', 'FAILED', 'QUEUE_FAILED'].includes(progress.status);

  const handleLaunchMassBatch = async () => {
    if (!preview || preview.eligibleContacts <= 0) {
      showToast.error('Nenhum contato elegível para disparo.');
      return;
    }

    setIsLaunchingBatch(true);
    showToast.info('Criando campanha e enfileirando destinatários...');
    try {
      const res = await apiClient.post('/campaigns/launch', {
        selectionMode: 'all',
        delaySeconds,
        expectedRecipients: preview.eligibleContacts,
        skipAlreadySent: true,
      });

      if (!res.data?.success) {
        showToast.error('Falha ao lançar campanha.');
        return;
      }

      const data = res.data.data;
      if (!data.queuedJobs || data.queuedJobs <= 0) {
        showToast.error('Campanha não enfileirou jobs (queuedJobs=0).');
        return;
      }

      showToast.success(
        `Campanha ${data.campaignId.slice(0, 8)}…: ${data.queuedJobs} jobs enfileirados (${data.estimatedBatches} lotes).`,
      );
      pushLog('SUCCESS', `queuedJobs=${data.queuedJobs} expected=${data.expectedRecipients}`);
      await refreshAll();
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data
        ?.message || (err as Error).message;
      showToast.error(`Erro ao lançar: ${msg}`);
      pushLog('ERROR', String(msg));
    } finally {
      setIsLaunchingBatch(false);
    }
  };

  const handleTogglePauseQueue = async () => {
    if (!progress?.campaignId) return;
    try {
      if (isPaused) {
        await apiClient.post(`/campaigns/${progress.campaignId}/resume`);
        showToast.success('Campanha retomada.');
      } else if (canPause) {
        await apiClient.post(`/campaigns/${progress.campaignId}/pause`);
        showToast.info('Campanha pausada.');
      }
      await loadActive();
    } catch (err) {
      showToast.error(`Não foi possível alterar pausa: ${(err as Error).message}`);
    }
  };

  const handleCancelActiveBroadcast = async () => {
    if (!progress?.campaignId || !canCancel) return;
    try {
      await apiClient.post(`/campaigns/${progress.campaignId}/cancel`);
      showToast.info('Campanha cancelada.');
      await refreshAll();
    } catch (err) {
      showToast.error(`Erro ao cancelar: ${(err as Error).message}`);
    }
  };

  const filteredJobs = jobs.filter((j) => filterStatus === 'ALL' || j.status === filterStatus);
  const failedJobsList = jobs.filter((j) => j.status === 'FAILED');

  const exclusionSummary = useMemo(() => {
    if (!preview) return null;
    return {
      total: preview.totalContacts,
      eligible: preview.eligibleContacts,
      excluded:
        preview.invalidContacts +
        preview.excludedContacts +
        preview.alreadySentContacts +
        preview.inactiveContacts,
    };
  }, [preview]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: '40px' }}>
      <div className="page-hero">
        <div className="page-hero-copy">
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Activity size={28} style={{ color: 'var(--primary)' }} />
            Campanhas
          </h1>
          <p>Crie, enfileire e acompanhe o progresso real da transmissão.</p>
        </div>
        <Button variant="secondary" icon={RefreshCw} onClick={() => void refreshAll()} isLoading={loading}>
          Atualizar
        </Button>
      </div>

      <div className="glass-panel" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20, borderColor: 'var(--success)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', backgroundColor: 'var(--success)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: 'color-mix(in srgb, var(--success) 14%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success)' }}>
              <TrendingUp size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>
                {progress ? progress.title : 'Nenhuma campanha ativa'}
              </h3>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {progress
                  ? `ID ${progress.campaignId.slice(0, 12)}… · ${progress.queuedJobs} jobs`
                  : 'Progresso vem do backend (não do estado local)'}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            {canResume || canPause ? (
              <Button
                type="button"
                variant={isPaused ? 'primary' : 'secondary'}
                icon={isPaused ? Play : Pause}
                onClick={() => void handleTogglePauseQueue()}
                style={isPaused ? { backgroundColor: 'var(--success)', borderColor: 'var(--success)' } : { borderColor: 'var(--warning)', color: 'var(--warning)' }}
              >
                {isPaused ? 'Retomar' : 'Pausar'}
              </Button>
            ) : null}
            {canCancel ? (
              <Button type="button" variant="secondary" icon={Ban} onClick={() => void handleCancelActiveBroadcast()} style={{ borderColor: 'var(--error)', color: 'var(--error)' }}>
                Cancelar
              </Button>
            ) : null}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: 'var(--surface)', padding: '28px', borderRadius: '16px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={18} style={{ color: 'var(--primary)' }} />
              Progresso: <strong style={{ color: 'var(--success)', fontSize: '1.2rem' }}>{progressPercentage}%</strong>
            </span>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              {processedJobsCount} de {totalTrackableJobs} processados
            </span>
          </div>
          <div style={{ width: '100%', height: '24px', borderRadius: '12px', backgroundColor: 'var(--surface)', overflow: 'hidden', boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.5)' }}>
            <div style={{ height: '100%', width: `${progressPercentage}%`, backgroundColor: 'var(--success)', transition: 'width 0.4s ease-out' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))', gap: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
            <div><span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sucessos</span><strong style={{ display: 'block', fontSize: '1.2rem' }}>{completedCount}</strong></div>
            <div><span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Falhas</span><strong style={{ display: 'block', fontSize: '1.2rem', color: 'var(--error)' }}>{failedCount}</strong></div>
            <div><span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Na fila</span><strong style={{ display: 'block', fontSize: '1.2rem', color: 'var(--primary)' }}>{queuedCount + processingCount}</strong></div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Status</span>
              <strong style={{ display: 'block', fontSize: '1rem', color: isPaused ? 'var(--warning)' : progress?.status === 'RUNNING' ? 'var(--success)' : 'var(--text-main)' }}>
                {beltStatus}
              </strong>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', borderColor: 'var(--primary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Layers size={22} style={{ color: 'var(--primary)' }} />
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Público-alvo</h3>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Seleção global no servidor — não depende da página carregada
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button type="button" variant={selectionMode === 'all' ? 'primary' : 'secondary'} onClick={() => { setSelectionMode('all'); void loadPreview(); }} style={{ height: 36, fontSize: '0.8rem' }}>
              Todos elegíveis
            </Button>
            <Button type="button" variant="secondary" onClick={() => void loadPreview()} isLoading={previewLoading} style={{ height: 36, fontSize: '0.8rem' }}>
              Recalcular prévia
            </Button>
          </div>
        </div>

        {preview ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
            <div style={{ padding: 14, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total na base</span>
              <strong style={{ display: 'block', fontSize: '1.3rem' }}>{preview.totalContacts}</strong>
            </div>
            <div style={{ padding: 14, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Elegíveis</span>
              <strong style={{ display: 'block', fontSize: '1.3rem', color: 'var(--success)' }}>{preview.eligibleContacts}</strong>
            </div>
            <div style={{ padding: 14, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Lotes (batch {preview.batchSize})</span>
              <strong style={{ display: 'block', fontSize: '1.3rem' }}>{preview.estimatedBatches}</strong>
            </div>
            <div style={{ padding: 14, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Já enviados (skip)</span>
              <strong style={{ display: 'block', fontSize: '1.3rem' }}>{preview.alreadySentContacts}</strong>
            </div>
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)' }}>Carregando prévia…</p>
        )}

        {exclusionSummary && exclusionSummary.excluded > 0 && (
          <div>
            <button type="button" onClick={() => setShowExclusionDetails((v) => !v)} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}>
              {showExclusionDetails ? 'Ocultar' : 'Ver'} detalhes da exclusão ({exclusionSummary.excluded})
            </button>
            {showExclusionDetails && preview && (
              <ul style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <li>Inativos: {preview.inactiveContacts}</li>
                <li>Telefone inválido: {preview.invalidContacts}</li>
                <li>Exclusões manuais: {preview.excludedContacts}</li>
                <li>Já enviados (skipAlreadySent): {preview.alreadySentContacts}</li>
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="responsive-grid">
        <div className="glass-panel" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '24px', borderColor: 'var(--primary)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: 'var(--primary)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Sliders size={24} style={{ color: 'var(--primary)' }} />
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Controle de lançamento</h3>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Intervalo antispam · volume = elegíveis do servidor</span>
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--surface)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <label style={{ fontWeight: 600 }}>Delay entre mensagens</label>
              <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{delaySeconds}s</span>
            </div>
            <input type="range" min="1" max="15" step="0.5" value={delaySeconds} onChange={(e) => setDelaySeconds(parseFloat(e.target.value))} style={{ width: '100%', accentColor: 'var(--primary)' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Quantidade total da campanha</span>
                <strong style={{ display: 'block', fontSize: '1.2rem' }}>{eligible}</strong>
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Tempo estimado</span>
                <strong style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FastForward size={18} /> {estimatedMinutes}m {estimatedRemainderSeconds}s
                </strong>
              </div>
            </div>
            {preview && (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                Tamanho dos lotes de enfileiramento: {preview.batchSize} · Lotes: {preview.estimatedBatches} · Intervalo: {delaySeconds}s
              </p>
            )}
          </div>

          <Button type="button" variant="primary" icon={Send} onClick={() => void handleLaunchMassBatch()} isLoading={isLaunchingBatch} style={{ height: 48, backgroundColor: 'var(--success)', borderColor: 'var(--success)' }}>
            {isLaunchingBatch ? 'Enfileirando…' : 'Criar campanha e entrar na fila'}
          </Button>
        </div>

        <div className="glass-panel" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Server size={24} style={{ color: 'var(--success)' }} />
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Métricas da fila</h3>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Contadores do backend</span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ padding: 20, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Em espera</span>
              <strong style={{ display: 'block', fontSize: '2rem', color: 'var(--primary)' }}>{queuedCount}</strong>
            </div>
            <div style={{ padding: 20, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Processando</span>
              <strong style={{ display: 'block', fontSize: '2rem', color: 'var(--warning)' }}>{processingCount}</strong>
            </div>
            <div style={{ padding: 20, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Disparados</span>
              <strong style={{ display: 'block', fontSize: '2rem', color: 'var(--success)' }}>{completedCount}</strong>
            </div>
            <div style={{ padding: 20, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Falhas</span>
              <strong style={{ display: 'block', fontSize: '2rem', color: 'var(--error)' }}>{failedCount}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}><AlertCircle size={18} /> Eventos SSE</h3>
          <Button type="button" variant="secondary" onClick={() => setLogs([])} style={{ height: 32, fontSize: '0.75rem' }}>Limpar</Button>
        </div>
        <div style={{ maxHeight: 180, overflow: 'auto', fontFamily: 'monospace', fontSize: '0.8rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
          {logs.length === 0 ? <span style={{ color: 'var(--text-muted)' }}>Aguardando eventos…</span> : logs.map((l) => (
            <div key={l.id} style={{ color: l.type === 'ERROR' ? 'var(--error)' : l.type === 'SUCCESS' ? 'var(--success)' : 'var(--text-muted)' }}>
              [{l.timestamp}] {l.message}
            </div>
          ))}
          <div ref={terminalBottomRef} />
        </div>
      </div>

      <div className="glass-panel" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldAlert size={18} /> Jobs da campanha ativa
          </h3>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ height: 36, borderRadius: 8, background: 'var(--surface)', color: 'var(--text-main)', border: '1px solid var(--border)' }}>
            {['ALL', 'QUEUED', 'ACTIVE', 'SENT', 'FAILED', 'SKIPPED', 'CANCELLED'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        {filteredJobs.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>Nenhum job listado. Sem campanha ativa ou fila vazia.</p>
        ) : (
          filteredJobs.map((job) => (
            <div key={job.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
              <div>
                <strong>{job.recipientName}</strong>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{job.recipientPhone}</div>
                {job.error ? <div style={{ fontSize: '0.75rem', color: 'var(--error)' }}>{job.error}</div> : null}
              </div>
              <Badge variant={job.status === 'FAILED' ? 'error' : job.status === 'SENT' ? 'success' : 'primary'}>{job.status}</Badge>
            </div>
          ))
        )}
        {failedJobsList.length > 0 && (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {failedJobsList.length} falha(s). Retry individual será re-enfileirado sem duplicar jobIds já SENT (skipAlreadySent).
          </p>
        )}
      </div>

      <div className="glass-panel" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}><History size={20} /> Histórico de campanhas</h3>
          <Badge variant="primary">Mês atual: {monthLabel}</Badge>
        </div>
        {historicalBatches.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>Nenhuma campanha registrada ainda (inclui PREPARING/QUEUED/COMPLETED).</p>
        ) : (
          historicalBatches.map((batch) => (
            <div key={batch.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: 16, borderRadius: 10, border: '1px solid var(--border)', flexWrap: 'wrap' }}>
              <div>
                <strong>{batch.title}</strong>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(batch.date).toLocaleString('pt-BR')} · {batch.status}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div>{batch.totalContacts} destinatários · {batch.successRate}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{batch.deliveredCount} enviados · {batch.duration}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default BroadcastQueue;
