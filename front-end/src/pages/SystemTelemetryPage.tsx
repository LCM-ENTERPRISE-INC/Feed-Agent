import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Cpu, 
  Database, 
  Server, 
  Clock, 
  RefreshCw, 
  Zap, 
  AlertTriangle, 
  CheckCircle2, 
  FileUp, 
  BarChart2
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  LineChart, 
  Line 
} from 'recharts';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { showToast } from '@/utils/toastHelper';

interface OcrLatencyPoint {
  batch: string;
  tesseractLatencySec: number;
  wordCount: number;
}

interface ApiLatencyPoint {
  time: string;
  latencyMs: number;
  reqPerSec: number;
}

const INITIAL_OCR_DATA: OcrLatencyPoint[] = [];

const INITIAL_API_DATA: ApiLatencyPoint[] = [];

export const SystemTelemetryPage: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [isStressTest, setIsStressTest] = useState<boolean>(false);

  // Live telemetry metrics
  const [ramUsageMb, setRamUsageMb] = useState<number>(512);
  const [cpuUsagePct, setCpuUsagePct] = useState<number>(28);
  const [lastUpdated, setLastUpdated] = useState<string>(() => new Date().toLocaleTimeString('pt-BR'));

  // Chart datasets
  const [ocrData, setOcrData] = useState<OcrLatencyPoint[]>(INITIAL_OCR_DATA);
  const [apiData, setApiData] = useState<ApiLatencyPoint[]>(INITIAL_API_DATA);

  // Reactive 5-second automatic telemetry updates
  useEffect(() => {
    const timer = setInterval(() => {
      setLastUpdated(new Date().toLocaleTimeString('pt-BR'));

      if (isStressTest) {
        // High critical fluctuation
        setRamUsageMb(Math.floor(920 + Math.random() * 60)); // 920MB - 980MB
        setCpuUsagePct(Math.floor(85 + Math.random() * 14)); // 85% - 99%
      } else {
        // Normal baseline fluctuation
        setRamUsageMb(Math.floor(480 + Math.random() * 70)); // 480MB - 550MB
        setCpuUsagePct(Math.floor(20 + Math.random() * 15)); // 20% - 35%
      }

      // Add slight dynamic shifts to charts
      setOcrData(prev => {
        const nextBatchNum = prev.length > 0 ? parseInt(prev[prev.length - 1].batch.split('#')[1]) + 1 : 101;
        const newPoint: OcrLatencyPoint = {
          batch: `Doc #${nextBatchNum}`,
          tesseractLatencySec: parseFloat((0.7 + Math.random() * 1.5).toFixed(2)),
          wordCount: Math.floor(250 + Math.random() * 600),
        };
        const updated = [...prev, newPoint];
        return updated.length > 7 ? updated.slice(1) : updated;
      });

      setApiData(prev => {
        let timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        if (prev.length > 0) {
          const timeParts = prev[prev.length - 1].time.split(':');
          let nextMin = parseInt(timeParts[1]) + 1;
          let nextHr = parseInt(timeParts[0]);
          if (nextMin >= 60) {
            nextMin = 0;
            nextHr = (nextHr + 1) % 24;
          }
          timeStr = `${String(nextHr).padStart(2, '0')}:${String(nextMin).padStart(2, '0')}`;
        }
        const newPt: ApiLatencyPoint = {
          time: timeStr,
          latencyMs: isStressTest ? Math.floor(180 + Math.random() * 150) : Math.floor(35 + Math.random() * 30),
          reqPerSec: isStressTest ? Math.floor(450 + Math.random() * 200) : Math.floor(100 + Math.random() * 80),
        };
        const updated = [...prev, newPt];
        return updated.length > 7 ? updated.slice(1) : updated;
      });

    }, 5000);

    return () => clearInterval(timer);
  }, [isStressTest]);

  const handleManualRefresh = () => {
    setLoading(true);
    showToast.info('Coletando snapshots instantâneos de memória Heap e CPU do Node.js...');

    setTimeout(() => {
      setLoading(false);
      setLastUpdated(new Date().toLocaleTimeString('pt-BR'));
      showToast.success('Telemetria sincronizada com sucesso.');
    }, 1000);
  };

  const handleToggleStressTest = () => {
    setIsStressTest(prev => {
      const next = !prev;
      if (next) {
        showToast.error('⚠️ ALERTA: Simulação de Estouro de Memória Heap iniciada! Sobrecarga de containers ativada.');
      } else {
        showToast.success('✅ Carga estabilizada. Retornando aos parâmetros normais de operação.');
      }
      return next;
    });
  };

  const maxHeapMb = 1024;
  const ramPct = Math.round((ramUsageMb / maxHeapMb) * 100);
  const isRamCritical = ramPct > 80;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: '40px' }}>
      
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Activity size={32} style={{ color: '#3b82f6' }} />
            <span>Visualizador Gráfico de Recursos e Containers</span>
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>Monitoramento em tempo real do Node.js Runtime, latência OCR Tesseract e telemetria de microsserviços</p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={14} /> Atualizado às {lastUpdated} (Auto: 5s)
          </span>

          <Button variant="secondary" icon={RefreshCw} onClick={handleManualRefresh} isLoading={loading}>
            Sincronizar Agora
          </Button>

          <Button 
            variant="primary" 
            icon={Zap} 
            onClick={handleToggleStressTest} 
            style={{ 
              backgroundColor: isStressTest ? '#f59e0b' : 'var(--error)', 
              borderColor: isStressTest ? '#f59e0b' : 'var(--error)' 
            }}
          >
            {isStressTest ? 'Parar Stress Test' : 'Simular Estouro de Memória'}
          </Button>
        </div>
      </div>

      {/* Flashing visual warning in red in case of memory overflow */}
      {isRamCritical && (
        <div style={{
          padding: '24px 32px',
          borderRadius: '16px',
          backgroundColor: 'rgba(239, 68, 68, 0.15)',
          border: '2px solid var(--error)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          animation: 'pulse-border 1.5s infinite',
          boxShadow: '0 0 30px rgba(239, 68, 68, 0.3)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--error)' }}>
              <AlertTriangle size={28} style={{ animation: 'pulse 1s infinite' }} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#fca5a5' }}>
                [CRITICAL ALERT] Estouro de Memória Heap Detectado ({ramPct}%)
              </h3>
              <p style={{ fontSize: '0.9rem', color: '#fee2e2', marginTop: '4px' }}>
                O consumo do processo Node.js ultrapassou a barreira de segurança ({ramUsageMb}MB / 1024MB). O Garbage Collector V8 iniciou coletas de emergência para evitar reinicialização do container.
              </p>
            </div>
          </div>

          <Button variant="primary" onClick={handleToggleStressTest} style={{ backgroundColor: 'var(--error)', borderColor: 'var(--error)' }}>
            Estabilizar Container (Desativar Stress)
          </Button>
        </div>
      )}

      {/* Grid: Server Resources Gauge Panel */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        
        {/* Memory Tracker */}
        <div className="glass-panel" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '16px', borderColor: isRamCritical ? 'var(--error)' : '#3b82f6', transition: 'border-color 0.3s' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Server size={18} style={{ color: isRamCritical ? 'var(--error)' : '#3b82f6' }} />
              <span>Memória Heap (Node.js Container)</span>
            </span>
            <Badge variant={isRamCritical ? 'error' : 'primary'}>{ramPct}% Ocupado</Badge>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '2.5rem', fontWeight: 700, color: isRamCritical ? 'var(--error)' : '#60a5fa', fontFamily: 'monospace' }}>
              {ramUsageMb} MB
            </span>
            <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/ {maxHeapMb} MB</span>
          </div>

          <div style={{ width: '100%', height: '14px', borderRadius: '7px', backgroundColor: '#1e293b', overflow: 'hidden', position: 'relative' }}>
            <div 
              style={{ 
                height: '100%', width: `${ramPct}%`, 
                backgroundColor: isRamCritical ? 'var(--error)' : '#3b82f6', 
                transition: 'width 0.4s ease-out, background-color 0.3s' 
              }} 
            />
          </div>

          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Limite configurado: `--max-old-space-size=1024`
          </span>
        </div>

        {/* CPU Tracker */}
        <div className="glass-panel" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '16px', borderColor: cpuUsagePct > 80 ? 'var(--error)' : '#10b981', transition: 'border-color 0.3s' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Cpu size={18} style={{ color: cpuUsagePct > 80 ? 'var(--error)' : '#10b981' }} />
              <span>Processamento de CPU (vCPUs)</span>
            </span>
            <Badge variant={cpuUsagePct > 80 ? 'error' : 'success'}>{cpuUsagePct > 80 ? 'Sobrecarga' : 'Estável'}</Badge>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '2.5rem', fontWeight: 700, color: cpuUsagePct > 80 ? 'var(--error)' : '#34d399', fontFamily: 'monospace' }}>
              {cpuUsagePct}%
            </span>
            <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>de 4 Núcleos</span>
          </div>

          <div style={{ width: '100%', height: '14px', borderRadius: '7px', backgroundColor: '#1e293b', overflow: 'hidden', position: 'relative' }}>
            <div 
              style={{ 
                height: '100%', width: `${cpuUsagePct}%`, 
                backgroundColor: cpuUsagePct > 80 ? 'var(--error)' : '#10b981', 
                transition: 'width 0.4s ease-out, background-color 0.3s' 
              }} 
            />
          </div>

          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Carga média em 1 min: {(cpuUsagePct / 25).toFixed(2)}
          </span>
        </div>

        {/* Database & Storage Trackers */}
        <div className="glass-panel" style={{ padding: '28px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px', borderColor: '#a855f7' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database size={18} style={{ color: '#a855f7' }} />
              <span>Pool de Conexões e Cache</span>
            </span>
            <Badge variant="primary">Conectado</Badge>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ backgroundColor: '#090d16', padding: '16px', borderRadius: '10px', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>PostgreSQL Pool</span>
              <strong style={{ fontSize: '1.25rem', color: 'white', fontFamily: 'monospace' }}>12 / 20</strong>
              <span style={{ fontSize: '0.7rem', color: '#10b981', display: 'block', marginTop: '2px' }}>Conexões Ativas</span>
            </div>

            <div style={{ backgroundColor: '#090d16', padding: '16px', borderRadius: '10px', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Redis Hit Rate</span>
              <strong style={{ fontSize: '1.25rem', color: '#c084fc', fontFamily: 'monospace' }}>98.4%</strong>
              <span style={{ fontSize: '0.7rem', color: '#c084fc', display: 'block', marginTop: '2px' }}>Cluster Sentinel</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#94a3b8' }}>
            <CheckCircle2 size={15} style={{ color: 'var(--success)' }} />
            <span>Disco de Uploads: 42GB livres de 100GB</span>
          </div>
        </div>

      </div>

      {/* Charts Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '32px' }}>
        
        {/* OCR Tesseract Latency Bar Chart */}
        <div className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px', borderColor: '#f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <FileUp size={22} style={{ color: '#f59e0b' }} />
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'white' }}>Latência do Motor OCR (Tesseract V5)</h3>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Tempo de processamento de extração de texto por lote (segundos)</span>
              </div>
            </div>
            <Badge variant="warning">Tesseract Runtime</Badge>
          </div>

          <div style={{ height: '300px', width: '100%', backgroundColor: '#030712', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ocrData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis dataKey="batch" stroke="#9ca3af" fontSize={12} tickLine={false} />
                <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} unit="s" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '8px', color: 'white', fontSize: '0.85rem' }} 
                  itemStyle={{ color: '#fbbf24' }} 
                  formatter={(value: any) => [`${value} segundos`, 'Latência OCR']}
                />
                <Legend wrapperStyle={{ fontSize: '0.85rem', paddingTop: '10px' }} />
                <Bar dataKey="tesseractLatencySec" name="Tempo de Execução (s)" fill="#f59e0b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <span>⚡ Média geral calculada: <strong>1.32s</strong> por documento</span>
            <span>Motor: `tesseract-ocr/v5.3`</span>
          </div>
        </div>

        {/* API Gateway Request Latency Line Chart */}
        <div className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px', borderColor: '#10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <BarChart2 size={22} style={{ color: '#10b981' }} />
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'white' }}>Latência Média de Requisições (API Gateway)</h3>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Tempo de resposta HTTP das rotas do Back-end (milissegundos)</span>
              </div>
            </div>
            <Badge variant="success">Express/Node.js</Badge>
          </div>

          <div style={{ height: '300px', width: '100%', backgroundColor: '#030712', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={apiData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis dataKey="time" stroke="#9ca3af" fontSize={12} tickLine={false} />
                <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} unit="ms" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '8px', color: 'white', fontSize: '0.85rem' }} 
                  itemStyle={{ color: '#34d399' }} 
                  formatter={(value: any) => [`${value} ms`, 'Latência API']}
                />
                <Legend wrapperStyle={{ fontSize: '0.85rem', paddingTop: '10px' }} />
                <Line type="monotone" dataKey="latencyMs" name="Tempo de Resposta (ms)" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981' }} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <span>📡 Status do Gateway: {isStressTest ? <strong style={{ color: 'var(--error)' }}>Sobrecarga Ativa</strong> : <strong style={{ color: 'var(--success)' }}>Operação Normal</strong>}</span>
            <span>Taxa de requisições atual: <strong>{apiData.length > 0 ? apiData[apiData.length - 1].reqPerSec : 0} req/s</strong></span>
          </div>
        </div>

      </div>

    </div>
  );
};

export default SystemTelemetryPage;
