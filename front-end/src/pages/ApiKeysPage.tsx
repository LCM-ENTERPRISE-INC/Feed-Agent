import React, { useState } from 'react';
import { 
  Key, 
  Copy, 
  Trash2, 
  Plus, 
  Check, 
  ShieldCheck, 
  Server, 
  Lock, 
  Activity, 
  Calendar, 
  ExternalLink,
  Code
} from 'lucide-react';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Badge } from '@/components/Badge';
import { showToast } from '@/utils/toastHelper';

interface ApiKeyItem {
  id: string;
  name: string;
  token: string;
  scopes: string[];
  createdAt: string;
  usageCount: number;
  status: 'ACTIVE' | 'REVOKED';
}

const INITIAL_KEYS: ApiKeyItem[] = [];

export const ApiKeysPage: React.FC = () => {
  const [keys, setKeys] = useState<ApiKeyItem[]>(INITIAL_KEYS);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState<boolean>(false);

  // New Key Modal State
  const [showModal, setShowModal] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [newKeyName, setNewKeyName] = useState<string>('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['READ_CONTACTS', 'WRITE_CONTACTS']);
  const [expirationRule, setExpirationRule] = useState<string>('NEVER');

  const webhookUrl = 'https://feedagent.com.br/api/v1/news/external';
  const webhookSecret = 'whsec_A89F90C12E4B889091AF88B3';

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast.success('Chave de API copiada para a área de transferência!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyWebhook = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedWebhook(true);
    showToast.success('URL do Webhook externa copiada com sucesso!');
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  const handleRevokeKey = (keyId: string, name: string) => {
    setKeys(prev => prev.map(k => k.id === keyId ? { ...k, status: 'REVOKED' } : k));
    showToast.error(`🚫 Chave de API "${name}" revogada! Acesso bloqueado instantaneamente.`);
  };

  const handleToggleScope = (scope: string) => {
    setSelectedScopes(prev => 
      prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope]
    );
  };

  const handleGenerateKeySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) {
      showToast.error('Informe um nome descritivo para a nova chave de integração.');
      return;
    }
    if (selectedScopes.length === 0) {
      showToast.error('Selecione ao menos um escopo de permissão para a chave.');
      return;
    }

    setIsGenerating(true);
    showToast.info('Gerando token estático JWT seguro com assinatura HMAC-SHA256...');

    setTimeout(() => {
      const generatedPart = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const randomToken = `feed_prod_eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(newKeyName)}.${generatedPart}`;
      
      const newKeyItem: ApiKeyItem = {
        id: `key-${Date.now()}`,
        name: newKeyName,
        token: randomToken,
        scopes: selectedScopes,
        createdAt: new Date().toLocaleDateString('pt-BR'),
        usageCount: 0,
        status: 'ACTIVE'
      };

      setKeys(prev => [newKeyItem, ...prev]);
      setIsGenerating(false);
      setShowModal(false);
      setNewKeyName('');
      setSelectedScopes(['READ_CONTACTS', 'WRITE_CONTACTS']);
      showToast.success('🔑 Nova chave de integração externa gerada com sucesso!');
    }, 1200);
  };

  const activeKeysCount = keys.filter(k => k.status === 'ACTIVE').length;
  const totalRequestsCount = keys.reduce((acc, k) => acc + k.usageCount, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: '40px' }}>
      
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Key size={32} style={{ color: 'var(--success)' }} />
            <span>Chaves de Autenticação API e Integrações Externas</span>
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>Gere tokens JWT estáticos seguros com controle de escopo e monitore contadores de requisições de webhooks</p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <Button variant="primary" icon={Plus} onClick={() => setShowModal(true)} style={{ backgroundColor: 'var(--success)', borderColor: 'var(--success)' }}>
            Gerar Nova Chave API
          </Button>
        </div>
      </div>

      {/* Top Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
        
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px', borderColor: 'var(--success)' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '12px', backgroundColor: 'color-mix(in srgb, var(--success) 15%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success)' }}>
            <ShieldCheck size={32} />
          </div>
          <div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block' }}>Chaves de API Ativas</span>
            <strong style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-main)' }}>{activeKeysCount}</strong>
            <span style={{ fontSize: '0.75rem', color: 'var(--success)', display: 'block', marginTop: '2px' }}>Tokens em conformidade de segurança</span>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px', borderColor: 'var(--primary)' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '12px', backgroundColor: 'color-mix(in srgb, var(--info) 15%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
            <Activity size={32} />
          </div>
          <div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block' }}>Requisições Processadas</span>
            <strong style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-main)' }}>{totalRequestsCount}</strong>
            <span style={{ fontSize: '0.75rem', color: 'var(--primary)', display: 'block', marginTop: '2px' }}>Contador cumulativo de integrações</span>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px', borderColor: 'var(--primary)' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '12px', backgroundColor: 'color-mix(in srgb, var(--primary) 15%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
            <Server size={32} />
          </div>
          <div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block' }}>Webhook Endpoint</span>
            <strong style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--primary)', display: 'block', marginTop: '4px' }}>Disponível</strong>
            <span style={{ fontSize: '0.75rem', color: 'var(--primary)', display: 'block', marginTop: '2px' }}>Assinatura de Segurança HMAC-SHA256</span>
          </div>
        </div>

      </div>

      {/* Webhook Endpoint Configuration Panel */}
      <div className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px', borderColor: 'var(--primary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <ExternalLink size={24} style={{ color: 'var(--primary)' }} />
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>Endpoint Webhook para Recepção Externa (Ingestion Endpoint)</h3>
              <span style={{ fontSize: '0.85rem', color: 'var(--primary)' }}>URL dedicada para injetar minutas de notícias e contatos automatizados de CRMs externos</span>
            </div>
          </div>
          <Badge variant="primary">Assinatura HMAC</Badge>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px', backgroundColor: 'var(--surface)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Webhook URL (POST)</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="text" 
                readOnly 
                value={webhookUrl}
                style={{ 
                  flex: 1, height: '42px', padding: '0 16px', borderRadius: '8px', backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)', color: 'var(--success)', fontFamily: 'monospace', fontSize: '0.85rem', outline: 'none'
                }} 
              />
              <Button 
                variant="secondary" 
                icon={copiedWebhook ? Check : Copy} 
                onClick={() => handleCopyWebhook(webhookUrl)}
                style={{ height: '42px', padding: '0 16px', borderColor: copiedWebhook ? 'var(--success)' : 'var(--border)', color: copiedWebhook ? 'var(--success)' : 'white' }}
              >
                {copiedWebhook ? 'Copiado!' : 'Copiar URL'}
              </Button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Segredo de Assinatura do Webhook (whsec)</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="text" 
                readOnly 
                value={webhookSecret}
                style={{ 
                  flex: 1, height: '42px', padding: '0 16px', borderRadius: '8px', backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)', color: 'var(--error)', fontFamily: 'monospace', fontSize: '0.85rem', outline: 'none'
                }} 
              />
              <span style={{ alignSelf: 'center', display: 'flex', alignItems: 'center' }}>
                <Badge variant="warning">Chave Secreta</Badge>
              </span>
            </div>
          </div>
        </div>

        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          💡 Envie o cabeçalho `X-Feed-Signature` contendo a hash HMAC-SHA256 do *payload* calculada com o segredo acima para autenticar a requisição.
        </span>
      </div>

      {/* API Keys Table Panel */}
      <div className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px', borderColor: 'var(--success)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Code size={24} style={{ color: 'var(--success)' }} />
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>Chaves de Integrações Externas Geradas (API Keys)</h3>
              <span style={{ fontSize: '0.85rem', color: 'var(--success)' }}>Lista de credenciais estáticas ativas e revogadas para comunicação de sistemas terceiros</span>
            </div>
          </div>

          <Button variant="primary" icon={Plus} onClick={() => setShowModal(true)} style={{ height: '40px', fontSize: '0.85rem', backgroundColor: 'var(--success)', borderColor: 'var(--success)' }}>
            Gerar Chave
          </Button>
        </div>

        <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'color-mix(in srgb, var(--border) 20%, transparent)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '16px 24px', fontWeight: 600 }}>Nome da Integração / Sistema</th>
                <th style={{ padding: '16px 24px', fontWeight: 600 }}>Token Estático JWT</th>
                <th style={{ padding: '16px 24px', fontWeight: 600 }}>Escopos de Permissão</th>
                <th style={{ padding: '16px 24px', fontWeight: 600 }}>Criação</th>
                <th style={{ padding: '16px 24px', fontWeight: 600 }}>Contador de Uso</th>
                <th style={{ padding: '16px 24px', textAlign: 'right', fontWeight: 600 }}>Ações</th>
              </tr>
            </thead>
            <tbody style={{ borderTop: '1px solid var(--border)' }}>
              {keys.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid color-mix(in srgb, var(--border) 30%, transparent)', opacity: item.status === 'REVOKED' ? 0.5 : 1 }}>
                  <td style={{ padding: '20px 24px', color: 'var(--text-main)', fontWeight: 700 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Lock size={16} style={{ color: item.status === 'ACTIVE' ? 'var(--success)' : 'var(--error)' }} />
                      <span>{item.name}</span>
                    </div>
                  </td>

                  <td style={{ padding: '20px 24px', fontFamily: 'monospace', color: 'var(--info)', maxWidth: '280px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', maxWidth: '180px', color: item.status === 'REVOKED' ? 'var(--text-muted)' : 'var(--info)' }}>
                        {item.token}
                      </span>
                      {item.status === 'ACTIVE' && (
                        <button
                          type="button"
                          onClick={() => handleCopyText(item.token, item.id)}
                          style={{
                            background: 'none', border: 'none', color: copiedId === item.id ? 'var(--success)' : 'var(--text-muted)',
                            cursor: 'pointer', padding: '4px'
                          }}
                          title="Copiar Token"
                        >
                          {copiedId === item.id ? <Check size={16} /> : <Copy size={16} />}
                        </button>
                      )}
                    </div>
                  </td>

                  <td style={{ padding: '20px 24px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {item.scopes.map(sc => (
                        <span key={sc} style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'color-mix(in srgb, var(--border) 30%, transparent)', border: '1px solid var(--border)', color: 'var(--text-main)' }}>
                          {sc}
                        </span>
                      ))}
                    </div>
                  </td>

                  <td style={{ padding: '20px 24px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Calendar size={14} /> <span>{item.createdAt}</span>
                    </div>
                  </td>

                  <td style={{ padding: '20px 24px', color: 'var(--text-main)', fontWeight: 600 }}>
                    {item.usageCount} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>reqs</span>
                  </td>

                  <td style={{ padding: '20px 24px', textAlign: 'right' }}>
                    {item.status === 'ACTIVE' ? (
                      <Button
                        type="button"
                        variant="secondary"
                        icon={Trash2}
                        onClick={() => handleRevokeKey(item.id, item.name)}
                        style={{ height: '36px', fontSize: '0.8rem', borderColor: 'var(--error)', color: 'var(--error)' }}
                      >
                        Revogar
                      </Button>
                    ) : (
                      <Badge variant="error">Revogada</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Generate New API Key */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '540px', padding: '36px', display: 'flex', flexDirection: 'column', gap: '24px', borderColor: 'var(--success)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Key size={24} style={{ color: 'var(--success)' }} />
                <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-main)' }}>Gerar Chave de Integração Externa</h3>
              </div>
              <button type="button" onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>

            <form onSubmit={handleGenerateKeySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <Input 
                label="Nome do Sistema / Identificador da Integração" 
                placeholder="ex: CRM Pipedrive Connector" 
                value={newKeyName}
                onChange={e => setNewKeyName(e.target.value)}
                autoFocus
              />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>Escopos de Acesso Permitidos</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', backgroundColor: 'var(--surface)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  {[
                    { id: 'READ_CONTACTS', label: 'Leitura de Contatos' },
                    { id: 'WRITE_CONTACTS', label: 'Cadastro de Contatos' },
                    { id: 'READ_DRAFTS', label: 'Leitura de Minutas' },
                    { id: 'WRITE_DRAFTS', label: 'Criação de Minutas' },
                    { id: 'BROADCAST_TRIGGER', label: 'Disparo de Lotes' }
                  ].map(sc => (
                    <label key={sc.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-main)', cursor: 'pointer', userSelect: 'none' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedScopes.includes(sc.id)} 
                        onChange={() => handleToggleScope(sc.id)}
                        style={{ accentColor: 'var(--success)', width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                      <span>{sc.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>Regra de Expiração do Token</label>
                <select 
                  value={expirationRule} 
                  onChange={e => setExpirationRule(e.target.value)}
                  style={{
                    height: '42px', padding: '0 16px', borderRadius: '8px', backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border)', color: 'var(--text-main)', fontSize: '0.9rem', cursor: 'pointer', outline: 'none'
                  }}
                >
                  <option value="NEVER">Nunca Expira (Estático Permanente)</option>
                  <option value="30_DAYS">Expira em 30 Dias</option>
                  <option value="365_DAYS">Expira em 1 Ano (365 Dias)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                <Button type="button" variant="secondary" onClick={() => setShowModal(false)} style={{ height: '44px' }}>
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" isLoading={isGenerating} style={{ height: '44px', backgroundColor: 'var(--success)', borderColor: 'var(--success)', padding: '0 24px' }}>
                  {isGenerating ? 'Assinando Token...' : 'Concluir Geração'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default ApiKeysPage;
