import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Phone, Users, FileUp, FileText, Send, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Alert } from '@/components/Alert';
import { StatePanel } from '@/components/StatePanel';
import { PageHeader } from '@/components/PageHeader';
import apiClient from '@/services/apiClient';

export const Dashboard: React.FC = () => {
  const [alertOpen, setAlertOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [metrics, setMetrics] = useState({
    totalLeads: 0,
    disparosConcluidos: 0,
    successRate: '0%',
    minutasGeradas: 0,
  });

  const fetchDashboardData = async () => {
    setLoading(true);
    setError('');
    try {
      const kpiRes = await apiClient.get('/analytics/kpi');
      const kpiData = kpiRes.data?.data || { totalReachedToday: 0, successRateToday: 0 };

      const contactsRes = await apiClient.get('/contacts?page=1&limit=1');
      const totalLeads = contactsRes.data?.data?.total || 0;

      let totalDrafts = 0;
      try {
        const draftsRes = await apiClient.get('/drafts');
        totalDrafts = draftsRes.data?.data?.length || 0;
      } catch {
        /* optional */
      }

      setMetrics({
        totalLeads,
        disparosConcluidos: kpiData.totalReachedToday,
        successRate: `${kpiData.successRateToday}%`,
        minutasGeradas: totalDrafts,
      });
    } catch {
      setError('Não foi possível carregar as métricas. Verifique a conexão com a API.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Fetch inicial + polling — atualização assíncrona de estado remoto
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial da API
    void fetchDashboardData();
  }, []);

  return (
    <div className="page-stack">
      {alertOpen && (
        <Alert variant="info" onClose={() => setAlertOpen(false)}>
          Fluxo sugerido: conectar WhatsApp → importar contatos → gerar minuta (OCR) → aprovar → disparar.
        </Alert>
      )}

      <PageHeader
        title="Painel"
        description="Resumo do dia e atalhos para o fluxo de disparos."
        actions={
          <Button variant="secondary" icon={RefreshCw} onClick={fetchDashboardData} isLoading={loading}>
            Atualizar
          </Button>
        }
      />

      {error && (
        <StatePanel variant="error" title="Falha ao carregar" description={error} actionLabel="Tentar de novo" onAction={fetchDashboardData} />
      )}

      {!error && (
        <div className="stat-grid" aria-busy={loading}>
          <div className="glass-panel stat-card">
            <span className="stat-card-label">Contatos</span>
            <div className="stat-card-row">
              <span className="stat-card-value">{loading ? '—' : metrics.totalLeads}</span>
              <Badge variant="neutral">Base</Badge>
            </div>
          </div>
          <div className="glass-panel stat-card">
            <span className="stat-card-label">Minutas</span>
            <div className="stat-card-row">
              <span className="stat-card-value">{loading ? '—' : metrics.minutasGeradas}</span>
              <Badge variant="primary">Studio</Badge>
            </div>
          </div>
          <div className="glass-panel stat-card">
            <span className="stat-card-label">Disparos hoje</span>
            <div className="stat-card-row">
              <span className="stat-card-value">{loading ? '—' : metrics.disparosConcluidos}</span>
              <Badge variant="success">{metrics.successRate} OK</Badge>
            </div>
          </div>
        </div>
      )}

      <section className="glass-panel" style={{ padding: 'var(--card-pad)' }}>
        <h2 style={{ marginBottom: 8 }}>Começar</h2>
        <p style={{ marginBottom: 20 }}>Escolha a próxima etapa do fluxo operacional.</p>
        <div className="quick-actions">
          <Link to="/whatsapp" className="quick-action">
            <span className="quick-action-icon" aria-hidden>
              <Phone size={18} />
            </span>
            <strong>WhatsApp</strong>
            <span>Conectar aparelho e ler o QR</span>
          </Link>
          <Link to="/contacts" className="quick-action">
            <span className="quick-action-icon" aria-hidden>
              <Users size={18} />
            </span>
            <strong>Contatos</strong>
            <span>Importar CSV ou cadastrar números</span>
          </Link>
          <Link to="/ocr" className="quick-action">
            <span className="quick-action-icon" aria-hidden>
              <FileUp size={18} />
            </span>
            <strong>Leitor OCR</strong>
            <span>Extrair texto de PDF ou imagem</span>
          </Link>
          <Link to="/drafts" className="quick-action">
            <span className="quick-action-icon" aria-hidden>
              <FileText size={18} />
            </span>
            <strong>Minutas</strong>
            <span>Revisar e aprovar conteúdo</span>
          </Link>
          <Link to="/broadcast" className="quick-action">
            <span className="quick-action-icon" aria-hidden>
              <Send size={18} />
            </span>
            <strong>Disparos</strong>
            <span>Acompanhar fila e histórico</span>
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
