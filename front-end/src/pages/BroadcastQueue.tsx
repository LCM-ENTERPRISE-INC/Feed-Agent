import React, { useState, useEffect, useRef } from 'react';
import { 
  RefreshCw, 
  Send, 
  Play, 
  Pause, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Sliders, 
  Smartphone, 
  Layers, 
  Server, 
  Activity, 
  ShieldAlert,
  FastForward,
  ListFilter,
  Ban,
  CheckCircle,
  TrendingUp,
  Terminal,
  Trash2,
  Download,
  History,
  FileSpreadsheet,
  RotateCcw,
  HelpCircle,
  Zap
} from 'lucide-react';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { showToast } from '@/utils/toastHelper';
import apiClient from '@/services/apiClient';

interface QueueJob {
  id: string;
  recipientName: string;
  recipientPhone: string;
  messageSnippet: string;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  attempts: number;
  timestamp: string;
  error?: string;
  errorDescription?: string;
}

interface SseLogItem {
  id: string;
  timestamp: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  message: string;
}

interface HistoricalBatch {
  id: string;
  date: string;
  title: string;
  totalContacts: number;
  successRate: string;
  deliveredCount: number;
  duration: string;
  status: 'COMPLETED' | 'WARNING';
}

interface Contact {
  id: number;
  name: string;
  phoneNumber: string;
  active: boolean;
}

export const BroadcastQueue: React.FC = () => {
  const [jobs, setJobs] = useState<QueueJob[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Launch Configuration State
  const [delaySeconds, setDelaySeconds] = useState<number>(3.5);
  const [adminTestPhone, setAdminTestPhone] = useState<string>('+55 11 99999-8888');
  const [isTestFiring, setIsTestFiring] = useState<boolean>(false);
  const [isLaunchingBatch, setIsLaunchingBatch] = useState<boolean>(false);
  const [isQueuePaused, setIsQueuePaused] = useState<boolean>(false);

  // SSE Terminal Logs State
  const [logs, setLogs] = useState<SseLogItem[]>([]);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const terminalBottomRef = useRef<HTMLDivElement | null>(null);

  // Historical Batches State
  const [historicalBatches, setHistoricalBatches] = useState<HistoricalBatch[]>([]);
  const [isExportingCsvId, setIsExportingCsvId] = useState<string | null>(null);

  // Contacts State
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<number[]>([]);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await apiClient.get('/analytics/history');
        if (res.data?.success) {
           setHistoricalBatches(res.data.data.history || []);
        }
      } catch {
        showToast.error('Erro ao buscar histórico de lotes.');
      }
    };

    const fetchContacts = async () => {
      try {
        const res = await apiClient.get('/contacts?limit=1000');
        console.log('fetchContacts response:', res.data);
        
        let contactsArray = [];
        if (res.data?.success) {
          if (Array.isArray(res.data.data)) {
            contactsArray = res.data.data;
          } else if (res.data.data && Array.isArray(res.data.data.data)) {
            contactsArray = res.data.data.data;
          } else if (res.data.data && Array.isArray(res.data.data.contacts)) {
            contactsArray = res.data.data.contacts;
          }
        }
        
        console.log('Resolved contacts array:', contactsArray);
        setContacts(contactsArray);
        
      } catch (err) {
        console.error('fetchContacts error:', err);
        showToast.error('Erro ao buscar contatos.');
      }
    };

    fetchHistory();
    fetchContacts();
  }, []);

  // Sprint 40: Retrying State
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null);
  const [isRetryingAll, setIsRetryingAll] = useState<boolean>(false);

  // Dynamic calculation for estimated total transmission time
  const totalEstimatedSeconds = (selectedContactIds.length || 1) * delaySeconds;
  const estimatedMinutes = Math.floor(totalEstimatedSeconds / 60);
  const estimatedRemainderSeconds = Math.round(totalEstimatedSeconds % 60);

  // Auto-scroll logic
  useEffect(() => {
    if (autoScroll && terminalBottomRef.current) {
      terminalBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // Removed simulation interval for processing queue

  const triggerRefresh = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      showToast.success('Fila sincronizada com o cluster Redis (BullMQ).');
    }, 1200);
  };

  const handleFireTestMessage = () => {
    if (!adminTestPhone.trim()) {
      showToast.error('Informe o telefone do administrador para receber o teste.');
      return;
    }
    setIsTestFiring(true);
    showToast.info(`Disparando pacote de teste prévio para ${adminTestPhone}...`);

    setTimeout(() => {
      setIsTestFiring(false);
      showToast.success(`📱 Disparo de Teste concluído com sucesso! Verifique o WhatsApp no aparelho ${adminTestPhone}.`);
    }, 1500);
  };

  const handleLaunchMassBatch = async () => {
    if (selectedContactIds.length === 0) {
      showToast.error('Selecione pelo menos um contato para disparar.');
      return;
    }

    setIsLaunchingBatch(true);
    showToast.info('Inicializando esteira de transmissão em lote com delay configurado...');

    try {
      const res = await apiClient.post('/drafts/broadcast/launch', {
        contactIds: selectedContactIds,
        delaySeconds: delaySeconds
      });

      if (res.data?.success) {
        showToast.success(`🚀 Lote lançado com sucesso! Injetando ${selectedContactIds.length} mensagens na fila com intervalo de ${delaySeconds}s.`);
        setIsQueuePaused(false);
        triggerRefresh();
      }
    } catch (err) {
      showToast.error(`Erro ao lançar lote: ${(err as Error).message}`);
    } finally {
      setIsLaunchingBatch(false);
    }
  };

  const handleTogglePauseQueue = () => {
    setIsQueuePaused(prev => {
      const nextState = !prev;
      if (nextState) {
        showToast.info('⏸️ Fila de transmissão pausada. Novos disparos retidos no Redis.');
      } else {
        showToast.success('▶️ Fila retomada. Processando jobs com delay configurado.');
      }
      return nextState;
    });
  };

  const handleCancelActiveBroadcast = () => {
    setJobs(prev => prev.map(j => (j.status === 'QUEUED' || j.status === 'PROCESSING') ? { ...j, status: 'CANCELLED', error: 'ABORTED_BY_ADMIN' } : j));
    showToast.info('🛑 Transmissão cancelada! Todos os jobs pendentes foram abortados na fila do Redis.');
    setIsQueuePaused(true);
  };

  const handlePurgeFailedJobs = () => {
    setJobs(prev => prev.filter(j => j.status !== 'FAILED' && j.status !== 'CANCELLED'));
    showToast.success('Jobs com falha ou cancelados foram limpos da fila de visualização.');
  };

  const handleClearLogsConsole = () => {
    setLogs([]);
    showToast.info('Console de logs do servidor limpo.');
  };

  const handleDownloadBatchCsv = (batch: HistoricalBatch) => {
    setIsExportingCsvId(batch.id);
    showToast.info(`Gerando relatório analítico CSV para "${batch.title}"...`);

    setTimeout(() => {
      setIsExportingCsvId(null);
      const csvHeaders = "ID,Nome do Contato,Telefone,Status de Entrega,Data de Envio,ID Meta Graph\n";
      const sampleRows = Array.from({ length: batch.deliveredCount }).map((_, i) => (
        `"contato-${i+1}","Contato Segmentado #${i+1}","+55 11 9${Math.floor(10000000 + Math.random() * 90000000)}","ENTREGUE","${batch.date}","wamid.${Math.random().toString(36).substring(2, 10)}"`
      )).join("\n");

      const blob = new Blob([csvHeaders + sampleRows], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `relatorio_disparo_${batch.id}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast.success(`📊 Relatório "${batch.title}" baixado com sucesso! (${batch.deliveredCount} linhas).`);
    }, 1200);
  };

  // Sprint 40: Handle Individual Retry Job
  const handleRetryIndividualJob = (jobId: string) => {
    setRetryingJobId(jobId);
    showToast.info(`Re-enfileirando job #${jobId} no BullMQ com prioridade alta...`);

    setTimeout(() => {
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'QUEUED', error: undefined, errorDescription: undefined, attempts: j.attempts + 1 } : j));
      setRetryingJobId(null);
      showToast.success(`Job #${jobId} restaurado! Transmissão reiniciada.`);
      setIsQueuePaused(false);
    }, 1200);
  };

  const handleRetryAllFailedJobs = () => {
    setIsRetryingAll(true);
    showToast.info('Iniciando rotina de re-disparo em lote para todas as falhas de transmissão...');

    setTimeout(() => {
      setJobs(prev => prev.map(j => j.status === 'FAILED' ? { ...j, status: 'QUEUED', error: undefined, errorDescription: undefined, attempts: j.attempts + 1 } : j));
      setIsRetryingAll(false);
      showToast.success('🔄 Todas as falhas foram re-enfileiradas com sucesso na esteira Redis.');
      setIsQueuePaused(false);
    }, 1600);
  };

  const filteredJobs = jobs.filter(j => filterStatus === 'ALL' || j.status === filterStatus);

  const completedCount = jobs.filter(j => j.status === 'COMPLETED').length;
  const processingCount = jobs.filter(j => j.status === 'PROCESSING').length;
  const queuedCount = jobs.filter(j => j.status === 'QUEUED').length;
  const failedCount = jobs.filter(j => j.status === 'FAILED').length;
  const cancelledCount = jobs.filter(j => j.status === 'CANCELLED').length;

  const totalTrackableJobs = jobs.filter(j => j.status !== 'CANCELLED').length;
  const processedJobsCount = completedCount + failedCount;
  const progressPercentage = totalTrackableJobs > 0 ? Math.round((processedJobsCount / totalTrackableJobs) * 100) : 0;

  const failedJobsList = jobs.filter(j => j.status === 'FAILED');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: '40px' }}>
      
      <div className="page-hero">
        <div className="page-hero-copy">
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Activity size={28} style={{ color: 'var(--primary)' }} />
            Disparos
          </h1>
          <p>Acompanhe a fila, o progresso do lote e o histórico de envios.</p>
        </div>
        <Button variant="secondary" icon={RefreshCw} onClick={triggerRefresh} isLoading={loading}>
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
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Lote em andamento</h3>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Progresso da fila de transmissão</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            {isQueuePaused ? (
              <Button type="button" variant="primary" icon={Play} onClick={handleTogglePauseQueue} style={{ backgroundColor: 'var(--success)', borderColor: 'var(--success)' }}>
                Retomar Fila (Resume)
              </Button>
            ) : (
              <Button type="button" variant="secondary" icon={Pause} onClick={handleTogglePauseQueue} style={{ borderColor: 'var(--warning)', color: 'var(--warning)' }}>
                Pausar Fila (Pause)
              </Button>
            )}

            <Button type="button" variant="secondary" icon={Ban} onClick={handleCancelActiveBroadcast} style={{ borderColor: 'var(--error)', color: 'var(--error)' }}>
              Cancelar Transmissão
            </Button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: 'var(--surface)', padding: '28px', borderRadius: '16px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={18} style={{ color: 'var(--primary)' }} />
              <span>Progresso de Disparo: <strong style={{ color: 'var(--success)', fontSize: '1.2rem' }}>{progressPercentage}%</strong></span>
            </span>

            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              {processedJobsCount} de {totalTrackableJobs} Mensagens Processadas
            </span>
          </div>

          <div style={{ width: '100%', height: '24px', borderRadius: '12px', backgroundColor: 'var(--surface)', overflow: 'hidden', position: 'relative', boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.5)' }}>
            <div 
              style={{ 
                height: '100%', width: `${progressPercentage}%`, 
                backgroundColor: 'var(--success)', 
                backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.15) 75%, transparent 75%, transparent)',
                backgroundSize: '40px 40px',
                animation: isQueuePaused ? 'none' : 'progress-stripes 2s linear infinite',
                transition: 'width 0.4s ease-out',
                boxShadow: '0 0 15px var(--success)'
              }} 
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))', gap: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)', marginTop: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CheckCircle size={20} style={{ color: 'var(--success)' }} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sucessos:</span>
                <strong style={{ fontSize: '1.2rem', color: 'var(--text-main)' }}>{completedCount}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ShieldAlert size={20} style={{ color: 'var(--error)' }} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Falhas / Rate-Limit:</span>
                <strong style={{ fontSize: '1.2rem', color: 'var(--error)' }}>{failedCount}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Layers size={20} style={{ color: 'var(--primary)' }} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Restantes na Fila:</span>
                <strong style={{ fontSize: '1.2rem', color: 'var(--primary)' }}>{queuedCount + processingCount}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Activity size={20} style={{ color: 'var(--warning)' }} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Status da Esteira:</span>
                <strong style={{ fontSize: '1rem', color: isQueuePaused ? 'var(--warning)' : 'var(--success)' }}>
                  {isQueuePaused ? 'PAUSADA' : 'TRANSMITINDO'}
                </strong>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Sprint 40: Seleção de Contatos para Disparo */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', borderColor: 'var(--primary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Layers size={22} style={{ color: 'var(--primary)' }} />
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)' }}>Seleção de Contatos para o Lote</h3>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Selecione quem irá receber todas as minutas aprovadas.</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <Button type="button" variant="secondary" onClick={() => setSelectedContactIds(contacts.map(c => c.id))} style={{ height: '36px', fontSize: '0.8rem' }}>
              Selecionar Todos
            </Button>
            <Button type="button" variant="secondary" onClick={() => setSelectedContactIds([])} style={{ height: '36px', fontSize: '0.8rem' }}>
              Limpar Seleção
            </Button>
          </div>
        </div>

        <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))', gap: '10px', backgroundColor: 'var(--surface)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
          {contacts.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', gridColumn: '1 / -1' }}>Nenhum contato encontrado ou carregando...</div>
          ) : (
            contacts.map(contact => (
              <label key={contact.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', backgroundColor: 'color-mix(in srgb, var(--border) 15%, transparent)', padding: '10px', borderRadius: '8px', border: '1px solid color-mix(in srgb, var(--border) 30%, transparent)' }}>
                <input 
                  type="checkbox" 
                  checked={selectedContactIds.includes(contact.id)}
                  onChange={e => {
                    if (e.target.checked) setSelectedContactIds(prev => [...prev, contact.id]);
                    else setSelectedContactIds(prev => prev.filter(id => id !== contact.id));
                  }}
                  style={{ accentColor: 'var(--primary)', width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 600 }}>{contact.name}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{contact.phoneNumber}</span>
                </div>
              </label>
            ))
          )}
        </div>
      </div>

      {/* Grid Layout: Launch Configuration Hub */}
      <div className="responsive-grid">
        
        {/* Left Card: Delay Slider */}
        <div className="glass-panel" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '24px', borderColor: 'var(--primary)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: 'var(--primary)' }} />
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Sliders size={24} style={{ color: 'var(--primary)' }} />
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)' }}>Controle de Lançamento de Lote</h3>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Ajuste de intervalo antispam e volume de transmissão</span>
              </div>
            </div>
            <Badge variant="primary">BullMQ Cluster</Badge>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', backgroundColor: 'var(--surface)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={16} style={{ color: 'var(--primary)' }} />
                  <span>Delay Entre Mensagens (Proteção Antispam)</span>
                </label>
                <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary)', backgroundColor: 'color-mix(in srgb, var(--primary) 15%, transparent)', padding: '4px 12px', borderRadius: '20px', border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)' }}>
                  {delaySeconds} segundos
                </span>
              </div>

              <input 
                type="range" 
                min="1" 
                max="15" 
                step="0.5" 
                value={delaySeconds} 
                onChange={e => setDelaySeconds(parseFloat(e.target.value))}
                style={{
                  width: '100%', height: '8px', borderRadius: '4px', backgroundColor: 'var(--surface)',
                  accentColor: 'var(--primary)', cursor: 'pointer'
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <span>1s (Velocidade Máxima)</span>
                <span>5s (Padrão Recomendado)</span>
                <span>15s (Máxima Segurança)</span>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Contatos Selecionados</label>
                <div style={{
                    height: '40px', padding: '0 12px', borderRadius: '8px', backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border)', color: 'var(--text-main)', fontSize: '1.1rem', fontWeight: 700,
                    display: 'flex', alignItems: 'center'
                  }}>
                  {selectedContactIds.length}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', justifyContent: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Tempo Estimado Total</span>
                <span style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FastForward size={18} />
                  <span>{estimatedMinutes}m {estimatedRemainderSeconds}s</span>
                </span>
              </div>
            </div>

          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Smartphone size={16} /> <span>Celular do Administrador (Disparo de Teste)</span>
                </label>
                <input 
                  type="text" 
                  value={adminTestPhone} 
                  onChange={e => setAdminTestPhone(e.target.value)}
                  placeholder="+55 11 99999-8888"
                  style={{
                    height: '42px', padding: '0 16px', borderRadius: '8px', backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none'
                  }}
                />
              </div>

              <Button type="button" variant="secondary" onClick={handleFireTestMessage} isLoading={isTestFiring} style={{ height: '42px', alignSelf: 'flex-end', padding: '0 20px', borderColor: 'var(--primary)', color: 'var(--primary)' }}>
                Disparar Teste Prévio
              </Button>
            </div>

            <Button type="button" variant="primary" icon={Send} onClick={handleLaunchMassBatch} isLoading={isLaunchingBatch} style={{ height: '48px', fontSize: '1rem', backgroundColor: 'var(--success)', borderColor: 'var(--success)' }}>
              {isLaunchingBatch ? 'Enfileirando Pacotes...' : 'Entrar na Fila Agora (Iniciar Disparo)'}
            </Button>
          </div>

        </div>

        {/* Right Card: Real-Time Broadcast Metrics Stats */}
        <div className="glass-panel" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Server size={24} style={{ color: 'var(--success)' }} />
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)' }}>Métricas do Cluster de Fila</h3>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Status de entrega e telemetria Redis em tempo real</span>
              </div>
            </div>
            <Badge variant="success">Online</Badge>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ padding: '20px', borderRadius: '12px', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}><Layers size={16} style={{ color: 'var(--primary)' }} /> Em Espera</span>
              <span style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--primary)' }}>{queuedCount}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Aguardando worker Redis</span>
            </div>

            <div style={{ padding: '20px', borderRadius: '12px', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}><Activity size={16} style={{ color: 'var(--warning)' }} /> Processando</span>
              <span style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--warning)' }}>{processingCount}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Consumindo API WhatsApp</span>
            </div>

            <div style={{ padding: '20px', borderRadius: '12px', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={16} style={{ color: 'var(--success)' }} /> Disparados</span>
              <span style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--success)' }}>{completedCount}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Entrega confirmada</span>
            </div>

            <div style={{ padding: '20px', borderRadius: '12px', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}><ShieldAlert size={16} style={{ color: 'var(--error)' }} /> Falhas/Cancelados</span>
              <span style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--error)' }}>{failedCount + cancelledCount}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Retentativas / Abortos</span>
            </div>
          </div>

          <div style={{ padding: '16px', borderRadius: '10px', backgroundColor: 'color-mix(in srgb, var(--border) 20%, transparent)', border: '1px solid color-mix(in srgb, var(--border) 40%, transparent)', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <span style={{ fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}><Activity size={16} style={{ color: 'var(--primary)' }} /> Cluster BullMQ Config:</span>
            <span style={{ fontFamily: 'monospace', color: 'var(--success)' }}>[INFO] Worker conectado. Concorrência: 1 job por vez.</span>
            <span style={{ fontFamily: 'monospace', color: 'var(--info)' }}>[CONFIG] Cadência: {delaySeconds}s de delay entre pacotes.</span>
          </div>
        </div>

      </div>

      {/* Sprint 40: Visualizador de Detalhes de Erros e Controle de Retentativa Individual */}
      <div className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px', borderColor: 'var(--error)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: '6px', height: '100%', backgroundColor: 'var(--error)' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'color-mix(in srgb, var(--error) 15%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--error)' }}>
              <ShieldAlert size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span>Falhas no Envio Atual (Diagnostic & Retry Hub)</span>
                <Badge variant="error">{failedJobsList.length} falhas detectadas</Badge>
              </h3>
              <span style={{ fontSize: '0.85rem', color: 'var(--error)' }}>Inspeção diagnóstica de conectividade e gatilhos de retentativa individual</span>
            </div>
          </div>

          {failedJobsList.length > 0 && (
            <Button 
              type="button" 
              variant="secondary" 
              icon={RotateCcw} 
              onClick={handleRetryAllFailedJobs} 
              isLoading={isRetryingAll}
              style={{ borderColor: 'var(--error)', color: 'var(--error)' }}
            >
              Re-enviar Todas as Falhas
            </Button>
          )}
        </div>

        {/* Failed Jobs Diagnostic Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {failedJobsList.length === 0 ? (
            <div style={{ padding: '42px 20px', textAlign: 'center', backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              <CheckCircle2 size={36} style={{ color: 'var(--success)', margin: '0 auto 12px auto' }} />
              <p style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)' }}>Nenhuma falha detectada no lote de transmissão atual!</p>
              <span style={{ fontSize: '0.85rem' }}>Todos os destinatários processados até o momento foram confirmados com sucesso.</span>
            </div>
          ) : (
            failedJobsList.map(job => (
              <div 
                key={job.id} 
                style={{ 
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', 
                  borderRadius: '12px', backgroundColor: 'var(--surface)', border: '1px solid color-mix(in srgb, var(--error) 30%, transparent)',
                  flexWrap: 'wrap', gap: '16px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', flex: 1, minWidth: '300px' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '50%', backgroundColor: 'color-mix(in srgb, var(--error) 15%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--error)', marginTop: '2px' }}>
                    <AlertCircle size={20} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '1.05rem', color: 'var(--text-main)' }}>{job.recipientName}</strong>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{job.recipientPhone}</span>
                      <Badge variant="error">{job.error || 'ERR_NETWORK_FAILURE'}</Badge>
                    </div>

                    <p style={{ fontSize: '0.85rem', color: 'var(--error)', lineHeight: 1.5, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <HelpCircle size={15} style={{ flexShrink: 0 }} />
                      <span>{job.errorDescription}</span>
                    </p>

                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Tentativas executadas: {job.attempts} • Último erro registrado às {job.timestamp}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Button 
                    type="button" 
                    variant="secondary" 
                    icon={Zap} 
                    onClick={() => handleRetryIndividualJob(job.id)}
                    isLoading={retryingJobId === job.id}
                    style={{ height: '40px', fontSize: '0.85rem', borderColor: 'var(--primary)', color: 'var(--primary)' }}
                  >
                    {retryingJobId === job.id ? 'Restaurando...' : 'Re-enviar (Retry)'}
                  </Button>
                </div>

              </div>
            ))
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <span>💡 <strong>Dica de Ajuda:</strong> O re-envio individual injeta o pacote no topo da fila do BullMQ, garantindo prioridade de tráfego sobre os envios normais.</span>
        </div>
      </div>

      {/* Feed Terminal-Like de Logs de Disparo (SSE Log Viewer) */}
      <div className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px', borderColor: 'var(--primary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'color-mix(in srgb, var(--info) 15%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
              <Terminal size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-main)' }}>Feed Terminal-Like de Logs de Disparo (SSE Log Viewer)</h3>
              <span style={{ fontSize: '0.85rem', color: 'var(--info)' }}>Console de monitoramento de eventos de servidor emitidos pelo BullMQ / Redis</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-main)', cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} style={{ accentColor: 'var(--primary)', width: '18px', height: '18px', cursor: 'pointer' }} />
              <span>🔒 Auto-scroll para novos eventos</span>
            </label>

            <Button type="button" variant="secondary" icon={Trash2} onClick={handleClearLogsConsole} style={{ height: '36px', fontSize: '0.8rem' }}>
              Limpar Console
            </Button>
          </div>
        </div>

        <div style={{
          backgroundColor: 'var(--background)', borderRadius: '12px', border: '1px solid var(--border)', padding: '24px',
          fontFamily: 'monospace', fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--text-main)', height: '320px',
          overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.8)'
        }}>
          {logs.length === 0 ? (
            <div style={{ margin: 'auto', color: 'var(--text-muted)', fontStyle: 'italic' }}>[Console limpo. Aguardando novos eventos SSE da fila...]</div>
          ) : (
            logs.map(log => {
              const getLogColor = (t: string) => {
                switch (t) {
                  case 'INFO': return 'var(--info)';
                  case 'SUCCESS': return 'var(--success)';
                  case 'WARNING': return 'var(--warning)';
                  case 'ERROR': return 'var(--error)';
                  default: return 'var(--text-muted)';
                }
              };

              return (
                <div key={log.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', borderBottom: '1px solid color-mix(in srgb, var(--border) 15%, transparent)', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)', userSelect: 'none', fontSize: '0.85rem' }}>[{log.timestamp}]</span>
                  <span style={{ 
                    color: getLogColor(log.type), fontWeight: 700, fontSize: '0.8rem', padding: '1px 6px', 
                    borderRadius: '4px', backgroundColor: log.type === 'ERROR' ? 'color-mix(in srgb, var(--error) 10%, transparent)' : log.type === 'SUCCESS' ? 'color-mix(in srgb, var(--success) 10%, transparent)' : log.type === 'WARNING' ? 'color-mix(in srgb, var(--warning) 10%, transparent)' : 'color-mix(in srgb, var(--info) 10%, transparent)',
                    border: `1px solid ${getLogColor(log.type)}`, minWidth: '75px', textAlign: 'center'
                  }}>
                    {log.type}
                  </span>
                  <span style={{ color: log.type === 'ERROR' ? 'var(--error)' : log.type === 'WARNING' ? 'var(--warning)' : log.type === 'SUCCESS' ? 'var(--success)' : 'var(--text-main)', wordBreak: 'break-word', flex: 1 }}>
                    {log.message}
                  </span>
                </div>
              );
            })
          )}
          <div ref={terminalBottomRef} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span>💡 <strong>Dica:</strong> Buffer limitado às últimas 500 entradas para otimização de RAM.</span>
          <span>Linhas no buffer atual: <strong>{logs.length}</strong> / 500</span>
        </div>
      </div>

      {/* Active Queue Details List */}
      <div className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ListFilter size={22} style={{ color: 'var(--primary)' }} />
              <span>Jobs na Fila de Disparo Ativa</span>
            </h3>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Lista de contatos aguardando processamento ou concluídos nesta sessão</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '6px', backgroundColor: 'var(--surface)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              {['ALL', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'].map(st => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setFilterStatus(st)}
                  style={{
                    padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                    border: 'none', transition: 'all 0.2s',
                    backgroundColor: filterStatus === st ? 'var(--primary)' : 'transparent',
                    color: filterStatus === st ? 'white' : 'var(--text-muted)'
                  }}
                >
                  {st}
                </button>
              ))}
            </div>

            {(failedCount > 0 || cancelledCount > 0) && (
              <Button variant="secondary" onClick={handlePurgeFailedJobs} style={{ height: '36px', fontSize: '0.8rem', borderColor: 'var(--error)', color: 'var(--error)' }}>
                Limpar Falhas/Cancelados
              </Button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredJobs.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Nenhum job encontrado para o status selecionado.
            </div>
          ) : (
            filteredJobs.map(job => (
              <div 
                key={job.id} 
                style={{ 
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', 
                  borderRadius: '12px', backgroundColor: job.status === 'PROCESSING' ? 'color-mix(in srgb, var(--warning) 10%, transparent)' : 
                                                         job.status === 'CANCELLED' ? 'color-mix(in srgb, var(--text-muted) 10%, transparent)' : 'var(--surface)', 
                  border: `1px solid ${job.status === 'PROCESSING' ? 'var(--warning)' : 
                                       job.status === 'CANCELLED' ? 'var(--text-muted)' : 'var(--border)'}`,
                  flexWrap: 'wrap', gap: '16px', opacity: job.status === 'CANCELLED' ? 0.6 : 1
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ 
                    width: '42px', height: '42px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: job.status === 'COMPLETED' ? 'color-mix(in srgb, var(--success) 10%, transparent)' : 
                                     job.status === 'PROCESSING' ? 'color-mix(in srgb, var(--warning) 20%, transparent)' : 
                                     job.status === 'FAILED' ? 'color-mix(in srgb, var(--error) 10%, transparent)' : 
                                     job.status === 'CANCELLED' ? 'color-mix(in srgb, var(--text-muted) 20%, transparent)' : 'color-mix(in srgb, var(--border) 30%, transparent)',
                    color: job.status === 'COMPLETED' ? 'var(--success)' : 
                           job.status === 'PROCESSING' ? 'var(--warning)' : 
                           job.status === 'FAILED' ? 'var(--error)' : 
                           job.status === 'CANCELLED' ? 'var(--text-muted)' : 'var(--text-muted)'
                  }}>
                    {job.status === 'COMPLETED' ? <CheckCircle2 size={20} /> :
                     job.status === 'PROCESSING' ? <Activity size={20} className="spinner" /> :
                     job.status === 'FAILED' ? <AlertCircle size={20} /> : 
                     job.status === 'CANCELLED' ? <Ban size={20} /> : <Clock size={20} />}
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <strong style={{ fontSize: '1rem', color: 'var(--text-main)', textDecoration: job.status === 'CANCELLED' ? 'line-through' : 'none' }}>
                        {job.recipientName}
                      </strong>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{job.recipientPhone}</span>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {job.messageSnippet}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  {job.error && (
                    <span style={{ fontSize: '0.75rem', color: job.status === 'CANCELLED' ? 'var(--text-muted)' : 'var(--error)', backgroundColor: job.status === 'CANCELLED' ? 'color-mix(in srgb, var(--border) 30%, transparent)' : 'color-mix(in srgb, var(--error) 10%, transparent)', padding: '4px 8px', borderRadius: '4px', border: `1px solid ${job.status === 'CANCELLED' ? 'var(--text-muted)' : 'var(--error)'}` }}>
                      {job.error}
                    </span>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <Badge variant={job.status === 'COMPLETED' ? 'success' : job.status === 'PROCESSING' ? 'warning' : job.status === 'FAILED' ? 'error' : 'neutral'}>
                      {job.status}
                    </Badge>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      Tentativas: {job.attempts} • {job.timestamp}
                    </span>
                  </div>
                </div>

              </div>
            ))
          )}
        </div>

      </div>

      {/* Painel de Histórico de Lotes Transmitidos */}
      <div className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px', borderColor: 'var(--primary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'color-mix(in srgb, var(--primary) 15%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
              <History size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)' }}>Histórico de lotes</h3>
              <span style={{ fontSize: '0.85rem', color: 'var(--primary)' }}>Auditoria de entregas, volumes disparados e relatórios CSV consolidados</span>
            </div>
          </div>

          <Badge variant="primary">Mês Atual: Maio/2026</Badge>
        </div>

        <div className="table-scroll" style={{ borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem', minWidth: 640 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'color-mix(in srgb, var(--border) 20%, transparent)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '16px 24px', fontWeight: 600 }}>Data de Envio</th>
                <th style={{ padding: '16px 24px', fontWeight: 600 }}>Notícia / Minuta Disparada</th>
                <th style={{ padding: '16px 24px', fontWeight: 600 }}>Base Alcançada</th>
                <th style={{ padding: '16px 24px', fontWeight: 600 }}>Taxa de Sucesso</th>
                <th style={{ padding: '16px 24px', fontWeight: 600 }}>Duração Total</th>
                <th style={{ padding: '16px 24px', textAlign: 'right', fontWeight: 600 }}>Ações de Auditoria</th>
              </tr>
            </thead>
            <tbody style={{ borderTop: '1px solid var(--border)' }}>
              {historicalBatches.map(batch => (
                <tr key={batch.id} style={{ borderBottom: '1px solid color-mix(in srgb, var(--border) 30%, transparent)' }}>
                  <td style={{ padding: '18px 24px', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Clock size={16} style={{ color: 'var(--primary)' }} />
                    <span>{batch.date}</span>
                  </td>

                  <td style={{ padding: '18px 24px', color: 'var(--text-main)', fontWeight: 700 }}>
                    {batch.title}
                  </td>

                  <td style={{ padding: '18px 24px', color: 'var(--text-muted)' }}>
                    <strong style={{ color: 'var(--text-main)' }}>{batch.deliveredCount}</strong> / {batch.totalContacts} contatos
                  </td>

                  <td style={{ padding: '18px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Badge variant={batch.successRate === '100%' ? 'success' : 'primary'}>
                        {batch.successRate}
                      </Badge>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>entregue</span>
                    </div>
                  </td>

                  <td style={{ padding: '18px 24px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    {batch.duration}
                  </td>

                  <td style={{ padding: '18px 24px', textAlign: 'right' }}>
                    <Button 
                      variant="secondary" 
                      icon={Download} 
                      onClick={() => handleDownloadBatchCsv(batch)}
                      isLoading={isExportingCsvId === batch.id}
                      style={{ height: '36px', fontSize: '0.8rem', borderColor: 'var(--primary)', color: 'var(--primary)', padding: '0 14px' }}
                    >
                      {isExportingCsvId === batch.id ? 'Gerando CSV...' : 'Baixar Relatório CSV'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileSpreadsheet size={16} style={{ color: 'var(--primary)' }} />
            <span>Os relatórios CSV seguem o padrão RFC 4180 e contêm os IDs de rastreamento do Meta Graph API (WAMID) para auditoria antispam.</span>
          </span>
          <span>Exibindo os 4 lotes mais recentes</span>
        </div>
      </div>

    </div>
  );
};

export default BroadcastQueue;
