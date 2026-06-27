import React, { useState, useMemo } from 'react';
import { 
  ShieldAlert, 
  Search, 
  RefreshCw, 
  Filter, 
  Clock, 
  User, 
  Terminal, 
  AlertTriangle, 
  Info, 
  FileJson,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { showToast } from '@/utils/toastHelper';

interface AuditLog {
  id: string;
  user: string;
  action: string;
  resource: string;
  ip: string;
  level: 'INFO' | 'WARNING' | 'ERROR' | 'SECURITY';
  timestamp: string;
  details: string;
}

const INITIAL_LOGS: AuditLog[] = [];

export const AuditLogsPage: React.FC = () => {
  const [logs] = useState<AuditLog[]>(INITIAL_LOGS);
  const [loading, setLoading] = useState<boolean>(false);
  
  // Filtering states
  const [searchRegex, setSearchRegex] = useState<string>('');
  const [levelFilter, setLevelFilter] = useState<string>('ALL');
  const [regexError, setRegexError] = useState<string | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(5);

  const handleSyncLogs = () => {
    setLoading(true);
    showToast.info('Sincronizando daemon de Syslog com o banco de auditoria...');

    setTimeout(() => {
      setLoading(false);
      showToast.success('Logs de auditoria sincronizados com sucesso.');
    }, 1200);
  };

  // Filter logs based on Level and Regex search
  const filteredLogs = useMemo(() => {
    setRegexError(null);
    let rx: RegExp | null = null;

    if (searchRegex.trim()) {
      try {
        rx = new RegExp(searchRegex, 'i');
      } catch (err) {
        setRegexError('Expressão Regular (Regex) com sintaxe incompleta ou inválida.');
      }
    }

    return logs.filter(log => {
      // Level filter
      if (levelFilter !== 'ALL' && log.level !== levelFilter) {
        return false;
      }

      // Regex search across user, action, resource, ip, and details
      if (rx) {
        const fullText = `${log.user} ${log.action} ${log.resource} ${log.ip} ${log.details}`;
        if (!rx.test(fullText)) {
          return false;
        }
      }

      return true;
    });
  }, [logs, searchRegex, levelFilter]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage) || 1;
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredLogs.slice(start, start + itemsPerPage);
  }, [filteredLogs, currentPage, itemsPerPage]);

  // Reset page to 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchRegex, levelFilter, itemsPerPage]);

  // Sprint 42: Export JSON Audit Report
  const handleExportJson = () => {
    showToast.info('Compilando pacote JSON com os logs filtrados em tela...');

    setTimeout(() => {
      const dataStr = JSON.stringify(filteredLogs, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `auditoria_sistema_${Date.now()}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast.success(`📦 Relatório JSON exportado com sucesso! (${filteredLogs.length} eventos).`);
    }, 1200);
  };

  const getLevelBadge = (lvl: string) => {
    switch (lvl) {
      case 'INFO': return <Badge variant="primary">Informativo</Badge>;
      case 'WARNING': return <Badge variant="warning">Aviso</Badge>;
      case 'ERROR': return <Badge variant="error">Erro Crítico</Badge>;
      case 'SECURITY': return <Badge variant="warning">Alerta de Segurança</Badge>;
      default: return <Badge variant="neutral">{lvl}</Badge>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: '40px' }}>
      
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <ShieldAlert size={32} style={{ color: '#a855f7' }} />
            <span>Console de Monitoramento de Logs do Servidor (Audit Log)</span>
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>Leitura e auditoria administrativa avançada com suporte a expressões regulares (Regex) e exportação JSON</p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <Button variant="secondary" icon={RefreshCw} onClick={handleSyncLogs} isLoading={loading}>
            Sincronizar Syslog
          </Button>

          <Button variant="primary" icon={FileJson} onClick={handleExportJson} style={{ backgroundColor: '#a855f7', borderColor: '#a855f7' }}>
            Exportar Logs em JSON
          </Button>
        </div>
      </div>

      {/* Filter Toolbar Section */}
      <div className="glass-panel" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px', borderColor: 'var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Filter size={20} style={{ color: '#a855f7' }} />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'white' }}>Filtros de Auditoria & Pesquisa Regex</h3>
          </div>

          <div style={{ display: 'flex', gap: '8px', backgroundColor: '#090d16', padding: '4px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            {['ALL', 'INFO', 'WARNING', 'ERROR', 'SECURITY'].map(lvl => (
              <button
                key={lvl}
                type="button"
                onClick={() => setLevelFilter(lvl)}
                style={{
                  padding: '6px 14px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                  border: 'none', transition: 'all 0.2s',
                  backgroundColor: levelFilter === lvl ? (lvl === 'SECURITY' ? '#a855f7' : lvl === 'ERROR' ? 'var(--error)' : lvl === 'WARNING' ? '#eab308' : 'var(--primary)') : 'transparent',
                  color: levelFilter === lvl ? 'white' : 'var(--text-muted)'
                }}
              >
                {lvl === 'ALL' ? 'Todos os Níveis' : lvl === 'SECURITY' ? 'Segurança' : lvl}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '16px', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <span style={{ position: 'absolute', left: '16px', top: '13px', color: 'var(--text-muted)' }}>
              <Search size={18} />
            </span>
            <input 
              type="text" 
              value={searchRegex} 
              onChange={e => setSearchRegex(e.target.value)}
              placeholder="Pesquisar por usuário, IP ou Expressão Regular (ex: ^superadmin|DELETE|192\.168\..*)..."
              style={{
                width: '100%', height: '44px', paddingLeft: '44px', paddingRight: '16px', borderRadius: '8px',
                backgroundColor: '#090d16', border: `1px solid ${regexError ? 'var(--error)' : 'var(--border)'}`, color: 'white',
                fontSize: '0.9rem', outline: 'none', fontFamily: searchRegex ? 'monospace' : 'var(--font-sans)'
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Exibir:</span>
            <select
              value={itemsPerPage}
              onChange={e => setItemsPerPage(Number(e.target.value))}
              style={{
                height: '44px', padding: '0 12px', borderRadius: '8px', backgroundColor: '#090d16',
                border: '1px solid var(--border)', color: 'white', fontSize: '0.85rem', cursor: 'pointer', outline: 'none'
              }}
            >
              <option value="5">5 logs / pág</option>
              <option value="10">10 logs / pág</option>
              <option value="25">25 logs / pág</option>
            </select>
          </div>
        </div>

        {regexError && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--error)', fontSize: '0.8rem', backgroundColor: 'rgba(239,68,68,0.1)', padding: '8px 12px', borderRadius: '6px' }}>
            <AlertTriangle size={16} />
            <span>{regexError}</span>
          </div>
        )}
      </div>

      {/* Main Audit Table Section */}
      <div className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px', borderColor: '#a855f7' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Terminal size={22} style={{ color: '#a855f7' }} />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'white' }}>Registros do Sistema (Audit Trail)</h3>
          </div>

          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Exibindo <strong>{paginatedLogs.length}</strong> de <strong>{filteredLogs.length}</strong> registros encontrados
          </span>
        </div>

        <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: '#090d16' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'rgba(255,255,255,0.03)', color: '#94a3b8' }}>
                <th style={{ padding: '16px 20px', fontWeight: 600 }}>Data / Hora</th>
                <th style={{ padding: '16px 20px', fontWeight: 600 }}>Usuário / Operador</th>
                <th style={{ padding: '16px 20px', fontWeight: 600 }}>Ação Executada</th>
                <th style={{ padding: '16px 20px', fontWeight: 600 }}>Recurso / Módulo</th>
                <th style={{ padding: '16px 20px', fontWeight: 600 }}>Endereço IP</th>
                <th style={{ padding: '16px 20px', fontWeight: 600 }}>Criticidade</th>
              </tr>
            </thead>
            <tbody style={{ borderTop: '1px solid var(--border)' }}>
              {paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Info size={32} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
                    <p style={{ fontSize: '1rem', fontWeight: 600, color: '#e2e8f0' }}>Nenhum log de auditoria encontrado</p>
                    <span style={{ fontSize: '0.8rem' }}>Tente redefinir os filtros de nível ou limpar a string de busca Regex.</span>
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => (
                  <React.Fragment key={log.id}>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', backgroundColor: log.level === 'SECURITY' ? 'rgba(168,85,247,0.03)' : log.level === 'ERROR' ? 'rgba(239,68,68,0.03)' : 'transparent' }}>
                      <td style={{ padding: '16px 20px', color: '#cbd5e1', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Clock size={14} style={{ color: 'var(--text-muted)' }} />
                        <span>{log.timestamp}</span>
                      </td>

                      <td style={{ padding: '16px 20px', color: 'white', fontWeight: 700 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <User size={14} style={{ color: 'var(--primary)' }} />
                          <span>{log.user}</span>
                        </div>
                      </td>

                      <td style={{ padding: '16px 20px', fontFamily: 'monospace', color: '#38bdf8', fontWeight: 600 }}>
                        {log.action}
                      </td>

                      <td style={{ padding: '16px 20px', color: '#e2e8f0' }}>
                        {log.resource}
                      </td>

                      <td style={{ padding: '16px 20px', fontFamily: 'monospace', color: '#94a3b8' }}>
                        {log.ip}
                      </td>

                      <td style={{ padding: '16px 20px' }}>
                        {getLevelBadge(log.level)}
                      </td>
                    </tr>
                    
                    {/* Log Details Sub-row */}
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', backgroundColor: 'rgba(0,0,0,0.2)' }}>
                      <td colSpan={6} style={{ padding: '10px 20px 14px 44px', color: '#94a3b8', fontSize: '0.8rem', lineHeight: 1.5 }}>
                        <span style={{ color: '#64748b', fontWeight: 600, marginRight: '8px' }}>Detalhes do Evento:</span>
                        <span style={{ color: log.level === 'ERROR' ? '#fca5a5' : log.level === 'SECURITY' ? '#e9d5ff' : '#cbd5e1' }}>{log.details}</span>
                      </td>
                    </tr>
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Robust Pagination Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', paddingTop: '8px' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Mostrando página <strong style={{ color: 'white' }}>{currentPage}</strong> de <strong style={{ color: 'white' }}>{totalPages}</strong>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{ height: '38px', padding: '0 16px', fontSize: '0.85rem' }}
            >
              <ChevronLeft size={16} /> Anterior
            </Button>

            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              {Array.from({ length: totalPages }).map((_, i) => {
                const pageNum = i + 1;
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    style={{
                      width: '38px', height: '38px', borderRadius: '8px', fontWeight: 700, fontSize: '0.85rem',
                      border: '1px solid var(--border)', cursor: 'pointer', transition: 'all 0.2s',
                      backgroundColor: currentPage === pageNum ? '#a855f7' : '#090d16',
                      color: currentPage === pageNum ? 'white' : 'var(--text-muted)'
                    }}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <Button
              type="button"
              variant="secondary"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              style={{ height: '38px', padding: '0 16px', fontSize: '0.85rem' }}
            >
              Próxima <ChevronRight size={16} />
            </Button>
          </div>
        </div>

      </div>

    </div>
  );
};

export default AuditLogsPage;
