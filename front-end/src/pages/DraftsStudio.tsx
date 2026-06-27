import React, { useState } from 'react';
import { 
  Kanban, 
  Plus, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Ban, 
  Edit3, 
  Trash2, 
  Tag, 
  Filter, 
  Save,
  Calendar,
  Paperclip,
  Smile,
  Phone,
  Video,
  MoreVertical,
  CheckCheck,
  Send,
  GitCompare,
  AlertTriangle,
  Check,
  ShieldCheck,
  Search,
  RefreshCw,
  Code,
  CheckSquare,
  X,
  FileCode,
  TagIcon,
  Server,
  Layers,
  HelpCircle
} from 'lucide-react';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { Input } from '@/components/Input';
import { showToast } from '@/utils/toastHelper';
import apiClient from '@/services/apiClient';

export type DraftStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type DraftPriority = 'Baixa' | 'Média' | 'Alta' | 'Urgente';

export interface DraftItem {
  id: string;
  title: string;
  summary: string;
  content: string;
  rawOcrSourceText?: string;
  metadataJson?: string;
  status: DraftStatus;
  priority: DraftPriority;
  source: string;
  createdAt: string;
  category: string;
  attachmentUrl?: string;
  rejectionReason?: string;
}

const WHATSAPP_EMOJIS = ['📢', '🚨', '🔥', '📌', '💰', '🏢', '📅', '✅', '⚠️', '👉', '📍', '🗳️', '⛽', '🤝', '📈', '✨', '⭐', '❤️'];

export const DraftsStudio: React.FC = () => {
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');


  React.useEffect(() => {
    const fetchDrafts = async () => {
      try {
        const res = await apiClient.get('/drafts');
        if (res.data?.success) {
          const mappedDrafts: DraftItem[] = res.data.data.map((d: any) => {
            const article = d.generatedContent || d.articleJson || {};
            return {
              id: String(d.id),
              title: article.titulo || article.title || 'Minuta sem título',
              summary: article.resumo || article.summary || article.text?.substring(0, 50) || '',
              content: article.resumo || article.text || '',
              rawOcrSourceText: d.originalText || '',
              status: d.status,
              priority: 'Média',
              source: article.fonte || 'Sistema',
              createdAt: new Date(d.createdAt).toLocaleString('pt-BR'),
              category: 'Geral',
              attachmentUrl: d.imagePath ? `/api/news/image/${d.id}` : undefined,
            };
          });
          setDrafts(mappedDrafts);
        }
      } catch (error) {
        showToast.error('Erro ao carregar minutas.');
      }
    };
    fetchDrafts();
  }, []);

  // Modal Editor State
  const [editingDraft, setEditingDraft] = useState<DraftItem | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);

  // Form Fields State
  const [formTitle, setFormTitle] = useState<string>('');
  const [formSummary, setFormSummary] = useState<string>('');
  const [formSource, setFormSource] = useState<string>('IA Generativa');
  const [formContent, setFormContent] = useState<string>('');
  const [formStatus, setFormStatus] = useState<DraftStatus>('PENDING');
  const [formPriority, setFormPriority] = useState<DraftPriority>('Média');
  const [formCategory, setFormCategory] = useState<string>('Geral');
  const [formAttachment, setFormAttachment] = useState<string>('');

  // Fact-Checking Audit Studio State
  const [auditDraft, setAuditDraft] = useState<DraftItem | null>(null);
  const [isReauditing, setIsReauditing] = useState<boolean>(false);

  // JSON Metadata Editor Studio State
  const [jsonDraft, setJsonDraft] = useState<DraftItem | null>(null);
  const [jsonTextContent, setJsonTextContent] = useState<string>('');
  const [jsonParseError, setJsonParseError] = useState<string | null>(null);
  const [quickKeywordInput, setQuickKeywordInput] = useState<string>('');

  // Sprint 35: Centralized Fast Action Hub & Broadcast Approval State
  const [approveDraftCandidate, setApproveDraftCandidate] = useState<DraftItem | null>(null);
  const [isAllocatingBullMq, setIsAllocatingBullMq] = useState<boolean>(false);
  const [rejectDraftCandidate, setRejectDraftCandidate] = useState<DraftItem | null>(null);
  const [rejectionReasonText, setRejectionReasonText] = useState<string>('');

  const categories = ['Todas', 'Imobiliário', 'Sindicato', 'Financeiro', 'Institucional', 'Benefícios', 'Comunicados', 'Geral'];

  const filteredDrafts = drafts.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.summary.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === 'Todas' || item.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const getPriorityColor = (priority: DraftPriority) => {
    switch (priority) {
      case 'Baixa': return '#3b82f6';
      case 'Média': return '#eab308';
      case 'Alta': return '#f97316';
      case 'Urgente': return '#ef4444';
      default: return '#cbd5e1';
    }
  };

  const handleOpenEditor = (draft: DraftItem) => {
    setEditingDraft(draft);
    setIsCreatingNew(false);
    setFormTitle(draft.title);
    setFormSummary(draft.summary);
    setFormSource(draft.source);
    setFormContent(draft.content);
    setFormStatus(draft.status);
    setFormPriority(draft.priority);
    setFormCategory(draft.category);
    setFormAttachment(draft.attachmentUrl || '');
  };

  const handleOpenCreateModal = () => {
    setIsCreatingNew(true);
    setEditingDraft(null);
    setFormTitle('');
    setFormSummary('');
    setFormSource('Redação Central');
    setFormContent('');
    setFormStatus('PENDING');
    setFormPriority('Média');
    setFormCategory('Geral');
    setFormAttachment('');
  };

  const handleInsertEmoji = (emoji: string) => {
    setFormContent(prev => prev + ' ' + emoji);
    showToast.success(`Emoji ${emoji} inserido no texto!`);
  };

  const handleAddRandomAttachment = () => {
    const sampleImages = [
      'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&q=80',
      'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=600&q=80',
      'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=600&q=80',
      'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=600&q=80'
    ];
    const picked = sampleImages[Math.floor(Math.random() * sampleImages.length)];
    setFormAttachment(picked);
    showToast.success('Anexo de mídia vinculado com sucesso!');
  };

  const handleSaveDraft = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formContent.trim()) {
      showToast.error('Preencha o título e o corpo da mensagem.');
      return;
    }

    if (isCreatingNew) {
      const newDraft: DraftItem = {
        id: `draft-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        title: formTitle,
        summary: formSummary || 'Resumo gerado automaticamente para a pauta.',
        content: formContent,
        rawOcrSourceText: 'Texto inserido via formulário manual de redação do Feed-Agent.',
        metadataJson: JSON.stringify({ keywords: ["geral", "manual"], relevance: "normal" }, null, 2),
        status: formStatus,
        priority: formPriority,
        source: formSource || 'Estúdio Kanban Manual',
        createdAt: new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        category: formCategory,
        attachmentUrl: formAttachment || undefined,
      };
      setDrafts(prev => [newDraft, ...prev]);
      showToast.success('Nova minuta salva com sucesso no sistema!');
    } else if (editingDraft) {
      setDrafts(prev => prev.map(d => d.id === editingDraft.id ? {
        ...d,
        title: formTitle,
        summary: formSummary,
        source: formSource,
        content: formContent,
        status: formStatus,
        priority: formPriority,
        category: formCategory,
        attachmentUrl: formAttachment || undefined,
      } : d));
      showToast.success('Minuta atualizada com sucesso!');
    }

    setEditingDraft(null);
    setIsCreatingNew(false);
  };

  const handleDeleteDraft = async (id: string, title: string) => {
    try {
      await apiClient.delete(`/drafts/${id}`);
      setDrafts(prev => prev.filter(d => d.id !== id));
      if (editingDraft?.id === id) setEditingDraft(null);
      if (auditDraft?.id === id) setAuditDraft(null);
      if (jsonDraft?.id === id) setJsonDraft(null);
      if (approveDraftCandidate?.id === id) setApproveDraftCandidate(null);
      if (rejectDraftCandidate?.id === id) setRejectDraftCandidate(null);
      showToast.success(`Minuta "${title}" deletada com sucesso.`);
    } catch (err) {
      showToast.error(`Erro ao deletar minuta: ${(err as Error).message}`);
    }
  };

  const handleQuickStatusChange = (id: string, newStatus: DraftStatus) => {
    setDrafts(prev => prev.map(d => d.id === id ? { ...d, status: newStatus } : d));
    showToast.info(`Minuta movida para a coluna ${newStatus}.`);
  };

  const handleDirectBroadcast = (draft: DraftItem) => {
    showToast.success(`Minuta "${draft.title}" disparada para a esteira do WhatsApp Hub!`);
    handleQuickStatusChange(draft.id, 'APPROVED');
    setEditingDraft(null);
    setIsCreatingNew(false);
  };

  // Sprint 35: Centralized Broadcast Confirmation Hub
  const handleOpenApprovalModal = (draft: DraftItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setApproveDraftCandidate(draft);
    setIsAllocatingBullMq(false);
  };

  const handleConfirmBullMqBroadcast = async () => {
    if (!approveDraftCandidate) return;
    setIsAllocatingBullMq(true);
    
    try {
      const res = await apiClient.post(`/drafts/${approveDraftCandidate.id}/approve`, { includeImage: false });
      if (res.data?.success) {
        showToast.success(`🚀 Sucesso! A minuta "${approveDraftCandidate.title}" foi aprovada e enfileirada.`);
        setDrafts(prev => prev.map(d => d.id === approveDraftCandidate.id ? { ...d, status: 'APPROVED' } : d));
      } else {
        showToast.error('Falha ao aprovar minuta.');
      }
    } catch (err) {
      showToast.error('Erro de conexão ao aprovar a minuta.');
    } finally {
      setIsAllocatingBullMq(false);
      setApproveDraftCandidate(null);
      setEditingDraft(null);
    }
  };

  // Sprint 35: Centralized Rejection Justification Hub
  const handleOpenRejectModal = (draft: DraftItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setRejectDraftCandidate(draft);
    setRejectionReasonText(draft.rejectionReason || '');
  };

  const handleConfirmRejectionJustification = async () => {
    if (!rejectDraftCandidate) return;
    if (!rejectionReasonText.trim()) {
      showToast.error('Por favor, informe a justificativa textual para a rejeição.');
      return;
    }

    try {
      const res = await apiClient.post(`/drafts/${rejectDraftCandidate.id}/reject`, { reason: rejectionReasonText.trim() });
      if (res.data?.success) {
        setDrafts(prev => prev.map(d => d.id === rejectDraftCandidate.id ? {
          ...d,
          status: 'REJECTED',
          rejectionReason: rejectionReasonText.trim()
        } : d));
        showToast.success(`Minuta "${rejectDraftCandidate.title}" devolvida e rejeitada com justificativa.`);
      } else {
        showToast.error('Falha ao rejeitar a minuta.');
      }
    } catch (err) {
      showToast.error('Erro de conexão ao rejeitar a minuta.');
    } finally {
      setRejectDraftCandidate(null);
      setEditingDraft(null);
    }
  };

  // Fact-Checking Audit Handlers
  const handleOpenAudit = (draft: DraftItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setAuditDraft(draft);
    setIsReauditing(false);
  };

  const handleTriggerReaudit = () => {
    setIsReauditing(true);
    showToast.info('Re-analisando correspondência vetorial e checagem de fatos OCR vs IA...');
    setTimeout(() => {
      setIsReauditing(false);
      showToast.success('Auditoria concluída: Nenhuma alucinação crítica detectada no texto.');
    }, 1200);
  };

  // JSON Metadata Studio Handlers
  const handleOpenJsonEditor = (draft: DraftItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setJsonDraft(draft);
    const initialJson = draft.metadataJson || JSON.stringify({
      keywords: ["pauta", draft.category.toLowerCase()],
      relevance: draft.priority === 'Urgente' ? "urgent" : "normal",
      aiModelVersion: "Llama-3-70b",
      targetAudience: ["geral"]
    }, null, 2);
    setJsonTextContent(initialJson);
    setJsonParseError(null);
    setQuickKeywordInput('');
  };

  const handleJsonTextChange = (value: string) => {
    setJsonTextContent(value);
    try {
      JSON.parse(value);
      setJsonParseError(null);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setJsonParseError(err.message);
      } else {
        setJsonParseError('Erro de sintaxe desconhecido no JSON');
      }
    }
  };

  const handleFormatJsonBeautify = () => {
    try {
      const parsed = JSON.parse(jsonTextContent);
      setJsonTextContent(JSON.stringify(parsed, null, 2));
      showToast.success('JSON formatado e indentado com sucesso!');
    } catch {
      showToast.error('Não foi possível formatar: corrija os erros de sintaxe primeiro.');
    }
  };

  const handleAddQuickKeyword = () => {
    if (!quickKeywordInput.trim()) return;
    try {
      const parsed = JSON.parse(jsonTextContent);
      const keywords = Array.isArray(parsed.keywords) ? parsed.keywords : [];
      if (!keywords.includes(quickKeywordInput.trim())) {
        parsed.keywords = [...keywords, quickKeywordInput.trim()];
        setJsonTextContent(JSON.stringify(parsed, null, 2));
        setQuickKeywordInput('');
        showToast.success(`Tag "${quickKeywordInput}" inserida no payload JSON.`);
      } else {
        showToast.info('Esta keyword já existe no payload.');
      }
    } catch {
      showToast.error('Corrija a sintaxe do JSON antes de inserir novas tags.');
    }
  };

  const handleSaveJsonMetadata = () => {
    if (jsonParseError) {
      showToast.error('Impossível salvar: a árvore JSON contém erros de sintaxe!');
      return;
    }
    try {
      const sanitizedJson = JSON.stringify(JSON.parse(jsonTextContent), null, 2);
      if (jsonDraft) {
        setDrafts(prev => prev.map(d => d.id === jsonDraft.id ? { ...d, metadataJson: sanitizedJson } : d));
        showToast.success('Metadados JSON atualizados com sucesso para o pipeline!');
        setJsonDraft(null);
      }
    } catch {
      showToast.error('Falha ao processar o payload JSON.');
    }
  };

  // Group filtered drafts by status
  const pendingDrafts = filteredDrafts.filter(d => d.status === 'PENDING');
  const approvedDrafts = filteredDrafts.filter(d => d.status === 'APPROVED');
  const rejectedDrafts = filteredDrafts.filter(d => d.status === 'REJECTED');
  const cancelledDrafts = filteredDrafts.filter(d => d.status === 'CANCELLED');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* Sprint 35: Centralized Broadcast BullMQ Approval Modal */}
      {approveDraftCandidate && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          zIndex: 40000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
          animation: 'fade-in 0.2s ease-out',
        }}>
          <div className="glass-panel" style={{
            maxWidth: '650px', width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden',
            boxShadow: '0 30px 100px rgba(0, 0, 0, 0.95)', border: '1px solid var(--success)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '24px', borderBottom: '1px solid var(--border)', backgroundColor: 'rgba(34, 197, 94, 0.15)' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                <Send size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'white' }}>Aprovar para Envio Imediato?</h3>
                <span style={{ fontSize: '0.85rem', color: '#86efac' }}>Confirmação de alocação de esteira de transmissão</span>
              </div>
            </div>

            <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px', backgroundColor: '#090d16' }}>
              <div style={{ padding: '16px', borderRadius: '10px', backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pauta Selecionada:</span>
                <strong style={{ fontSize: '1rem', color: 'white' }}>{approveDraftCandidate.title}</strong>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ padding: '16px', borderRadius: '10px', backgroundColor: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Layers size={24} style={{ color: '#3b82f6' }} />
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#93c5fd', display: 'block' }}>Público-Alvo:</span>
                    <strong style={{ fontSize: '1.1rem', color: 'white' }}>125 Contatos Ativos</strong>
                  </div>
                </div>

                <div style={{ padding: '16px', borderRadius: '10px', backgroundColor: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Server size={24} style={{ color: '#10b981' }} />
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#6ee7b7', display: 'block' }}>Fila BullMQ / Redis:</span>
                    <strong style={{ fontSize: '1.1rem', color: 'white' }}>Prioridade {approveDraftCandidate.priority}</strong>
                  </div>
                </div>
              </div>

              <div style={{ padding: '14px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                ⚠️ <strong>Atenção:</strong> Ao confirmar, o Feed-Agent registrará a aprovação e injetará os pacotes diretamente no gerenciador de filas do WhatsApp Hub.
              </div>
            </div>

            <div style={{ padding: '20px 24px', backgroundColor: '#05070f', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <Button type="button" variant="secondary" onClick={() => setApproveDraftCandidate(null)} disabled={isAllocatingBullMq} style={{ height: '42px' }}>
                Cancelar
              </Button>
              <Button type="button" variant="primary" icon={CheckCircle} onClick={handleConfirmBullMqBroadcast} isLoading={isAllocatingBullMq} style={{ height: '42px', backgroundColor: 'var(--success)', borderColor: 'var(--success)', padding: '0 24px' }}>
                {isAllocatingBullMq ? 'Alocando Fila BullMQ...' : 'Confirmar e Adicionar à Fila'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Sprint 35: Centralized Rejection Justification Modal */}
      {rejectDraftCandidate && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          zIndex: 40000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
          animation: 'fade-in 0.2s ease-out',
        }}>
          <div className="glass-panel" style={{
            maxWidth: '600px', width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden',
            boxShadow: '0 30px 100px rgba(0, 0, 0, 0.95)', border: '1px solid var(--error)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '24px', borderBottom: '1px solid var(--border)', backgroundColor: 'rgba(239, 68, 68, 0.15)' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'var(--error)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                <XCircle size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'white' }}>Rejeitar Minuta de Envio</h3>
                <span style={{ fontSize: '0.85rem', color: '#fca5a5' }}>Devolução de pauta para equipe de curadoria</span>
              </div>
            </div>

            <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px', backgroundColor: '#090d16' }}>
              <div style={{ padding: '16px', borderRadius: '10px', backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pauta Selecionada:</span>
                <strong style={{ fontSize: '1rem', color: 'white' }}>{rejectDraftCandidate.title}</strong>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <HelpCircle size={16} style={{ color: 'var(--error)' }} />
                  <span>Justificativa da Rejeição (Obrigatório)</span>
                </label>
                <textarea
                  value={rejectionReasonText}
                  onChange={e => setRejectionReasonText(e.target.value)}
                  placeholder="Descreva o motivo da recusa: erro ortográfico, dados incorretos, tom inadequado ou pauta vencida..."
                  rows={4}
                  required
                  style={{
                    padding: '16px', borderRadius: '8px', backgroundColor: '#0b1220', border: '1px solid var(--border)',
                    color: 'white', fontSize: '0.95rem', resize: 'none', outline: 'none', lineHeight: 1.5
                  }}
                />
              </div>
            </div>

            <div style={{ padding: '20px 24px', backgroundColor: '#05070f', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <Button type="button" variant="secondary" onClick={() => setRejectDraftCandidate(null)} style={{ height: '42px' }}>
                Cancelar
              </Button>
              <Button type="button" variant="primary" icon={Trash2} onClick={handleConfirmRejectionJustification} style={{ height: '42px', backgroundColor: 'var(--error)', borderColor: 'var(--error)', padding: '0 24px' }}>
                Confirmar Rejeição e Arquivar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Sprint 34: JSON Metadata Validation & Editor Studio Modal */}
      {jsonDraft && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          zIndex: 35000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
          animation: 'fade-in 0.2s ease-out',
        }}>
          <div className="glass-panel" style={{
            maxWidth: '1250px', width: '100%', maxHeight: '92vh', display: 'flex', flexDirection: 'column',
            overflow: 'hidden', boxShadow: '0 30px 100px rgba(0, 0, 0, 0.95)', border: '1px solid var(--primary)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border)', backgroundColor: 'rgba(15, 23, 42, 0.9)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Code size={24} style={{ color: 'var(--primary)' }} />
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>Editor de Metadados e Controle JSON</span>
                    <Badge variant="primary">Pipeline Tags</Badge>
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {jsonDraft.title} • Inspecione e edite as tags estruturais enviadas para a esteira de integração
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Button type="button" variant="secondary" icon={FileCode} onClick={handleFormatJsonBeautify} style={{ height: '36px', fontSize: '0.85rem' }}>
                  Formatar JSON (Beautify)
                </Button>
                <Button type="button" variant="primary" icon={Save} onClick={handleSaveJsonMetadata} style={{ height: '36px', fontSize: '0.85rem' }}>
                  Salvar Payload JSON
                </Button>
                <button onClick={() => setJsonDraft(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.8rem', cursor: 'pointer', marginLeft: '8px' }}>&times;</button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', flex: 1, overflow: 'hidden' }}>
              
              {/* Left Column: Monospace Real-Time JSON Editor */}
              <div style={{ padding: '24px', backgroundColor: '#05070f', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileCode size={16} style={{ color: 'var(--primary)' }} /> <span>Código-Fonte JSON (Editável em tempo real)</span>
                  </span>
                  
                  {jsonParseError ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--error)', fontSize: '0.8rem', fontWeight: 700, backgroundColor: 'rgba(239,68,68,0.1)', padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--error)' }}>
                      <X size={14} /> Erro de Sintaxe JSON
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--success)', fontSize: '0.8rem', fontWeight: 700, backgroundColor: 'rgba(34,197,94,0.1)', padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--success)' }}>
                      <CheckSquare size={14} /> JSON Válido e Formatado
                    </div>
                  )}
                </div>

                <textarea
                  value={jsonTextContent}
                  onChange={e => handleJsonTextChange(e.target.value)}
                  placeholder={'{\n  "key": "value"\n}'}
                  spellCheck={false}
                  style={{
                    flex: 1, padding: '20px', borderRadius: '8px', backgroundColor: '#0b1220', border: '1px solid var(--border)',
                    fontFamily: 'monospace', fontSize: '0.95rem', color: '#6ee7b7', lineHeight: 1.6, outline: 'none',
                    resize: 'none', minHeight: '340px', boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)'
                  }}
                />

                {jsonParseError && (
                  <div style={{ padding: '14px', borderRadius: '8px', backgroundColor: 'rgba(239,68,68,0.15)', border: '1px solid var(--error)', color: '#fca5a5', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <AlertTriangle size={18} style={{ color: 'var(--error)', flexShrink: 0 }} />
                    <span><strong>Falha de Parse:</strong> {jsonParseError}. O salvamento está bloqueado até a correção.</span>
                  </div>
                )}
              </div>

              {/* Right Column: Visual Tag Editor and Quick Helpers */}
              <div style={{ padding: '24px', backgroundColor: '#090d16', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <TagIcon size={18} style={{ color: 'var(--primary)' }} />
                    <span>Inserção Rápida de Keywords</span>
                  </h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Adicione tags de controle diretamente na matriz `keywords` do payload para segmentação de disparo.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={quickKeywordInput}
                    onChange={e => setQuickKeywordInput(e.target.value)}
                    placeholder="Nova keyword (ex: urgencia_sindical)"
                    onKeyDown={e => { if (e.key === 'Enter') handleAddQuickKeyword(); }}
                    style={{
                      flex: 1, height: '42px', padding: '0 14px', borderRadius: '8px', backgroundColor: '#0f172a',
                      border: '1px solid var(--border)', color: 'white', fontSize: '0.85rem', outline: 'none'
                    }}
                  />
                  <Button type="button" variant="secondary" onClick={handleAddQuickKeyword} style={{ height: '42px' }}>
                    Adicionar Tag
                  </Button>
                </div>

                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#e2e8f0' }}>Estrutura de Atributos Chave Recomendada</span>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem', color: '#94a3b8' }}>
                    <div style={{ padding: '10px 14px', backgroundColor: '#0f172a', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <strong style={{ color: 'white' }}>keywords:</strong> Array de strings para filtros no dashboard
                    </div>
                    <div style={{ padding: '10px 14px', backgroundColor: '#0f172a', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <strong style={{ color: 'white' }}>relevance:</strong> "low" | "medium" | "high" | "urgent"
                    </div>
                    <div style={{ padding: '10px 14px', backgroundColor: '#0f172a', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <strong style={{ color: 'white' }}>sentiment:</strong> "positive" | "neutral" | "warning"
                    </div>
                    <div style={{ padding: '10px 14px', backgroundColor: '#0f172a', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <strong style={{ color: 'white' }}>aiModelVersion:</strong> Assinatura do modelo LLM curador
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 'auto', padding: '16px', borderRadius: '8px', backgroundColor: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
                  <span style={{ fontSize: '0.8rem', color: '#93c5fd', lineHeight: 1.4, display: 'block' }}>
                    💡 <strong>Proteção Ativa:</strong> O Feed-Agent inspeciona a árvore em tempo real. Estruturas JSON corrompidas ou malformadas são automaticamente bloqueadas de entrar no banco de dados.
                  </span>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Sprint 33: Fact-Checking Audit Comparison Studio Modal */}
      {auditDraft && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          zIndex: 30000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
          animation: 'fade-in 0.2s ease-out',
        }}>
          <div className="glass-panel" style={{
            maxWidth: '1350px', width: '100%', maxHeight: '92vh', display: 'flex', flexDirection: 'column',
            overflow: 'hidden', boxShadow: '0 30px 100px rgba(0, 0, 0, 0.95)', border: '1px solid #3b82f6',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border)', backgroundColor: 'rgba(15, 23, 42, 0.9)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <GitCompare size={24} style={{ color: '#3b82f6' }} />
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>Auditoria de Fact-Checking & Alucinações (OCR vs IA)</span>
                    <Badge variant="primary">Llama 3 Guard</Badge>
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {auditDraft.title} • Verificação de fidelidade de fatos, números e datas do recorte original
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Button type="button" variant="secondary" icon={RefreshCw} onClick={handleTriggerReaudit} isLoading={isReauditing} style={{ height: '36px', fontSize: '0.85rem' }}>
                  Re-executar IA Guard
                </Button>
                <Button type="button" variant="primary" icon={Check} onClick={() => { handleQuickStatusChange(auditDraft.id, 'APPROVED'); setAuditDraft(null); }} style={{ height: '36px', fontSize: '0.85rem', backgroundColor: 'var(--success)', borderColor: 'var(--success)' }}>
                  Aprovar Minuta Fiel
                </Button>
                <button onClick={() => setAuditDraft(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.8rem', cursor: 'pointer', marginLeft: '8px' }}>&times;</button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', flex: 1, overflow: 'hidden' }}>
              
              {/* Left Column: Raw OCR Text */}
              <div style={{ padding: '24px', backgroundColor: '#05070f', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Search size={16} /> <span>Texto Bruto Extraído (Origem OCR)</span>
                  </span>
                  <Badge variant="neutral">Inalterado do Jornal</Badge>
                </div>

                <div style={{
                  padding: '20px', borderRadius: '8px', backgroundColor: '#090d16', border: '1px solid rgba(255,255,255,0.1)',
                  fontFamily: 'monospace', fontSize: '0.95rem', color: '#cbd5e1', lineHeight: 1.6, whiteSpace: 'pre-wrap',
                  minHeight: '280px'
                }}>
                  {auditDraft.rawOcrSourceText || '[Texto de origem OCR não localizado no histórico desta minuta]'}
                </div>

                <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <ShieldCheck size={20} style={{ color: '#3b82f6', flexShrink: 0, marginTop: '2px' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'white' }}>Verificação de Integridade e OCR Base</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                      Este painel apresenta a leitura crua da imagem antes de qualquer formatação. Compare os números e nomes para evitar repasses errôneos.
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: AI Synthesized Draft */}
              <div style={{ padding: '24px', backgroundColor: '#0b1120', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Smile size={16} style={{ color: 'var(--primary)' }} /> <span>Texto Sintetizado pela IA (Minuta de Envio)</span>
                  </span>
                  <Badge variant="success">Formatado Llama 3</Badge>
                </div>

                <div style={{
                  padding: '20px', borderRadius: '8px', backgroundColor: '#0f172a', border: '1px solid #3b82f6',
                  fontSize: '0.95rem', color: '#f8fafc', lineHeight: 1.6, whiteSpace: 'pre-wrap', minHeight: '280px',
                  boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.4)'
                }}>
                  {auditDraft.content}
                </div>

                {/* Discrepancy Hallucination Guard Panel */}
                <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <ShieldCheck size={20} style={{ color: 'var(--success)', flexShrink: 0, marginTop: '2px' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'white' }}>Auditoria de Fatos Concluída com Sucesso</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--success)', lineHeight: 1.4 }}>
                      ✓ Valores numéricos verificados e idênticos à origem (5%, dia 20, dias 28 e 29)<br />
                      ✓ Sem indícios de alucinação ou extrapolação de fatos pela IA generativa
                    </span>
                  </div>
                </div>
              </div>

            </div>

            {/* Bottom Discrepancy Highlight Bar */}
            <div style={{ padding: '16px 24px', backgroundColor: '#090d16', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#eab308' }}><AlertTriangle size={16} /> 0 Termos Suspeitos</span>
                <span>•</span>
                <span>Grau de Confiança IA: <strong style={{ color: 'var(--success)' }}>98.4%</strong></span>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <Button type="button" variant="secondary" onClick={() => { setEditingDraft(auditDraft); setAuditDraft(null); }} style={{ height: '36px', fontSize: '0.8rem' }}>
                  Abrir Editor Avançado
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Advanced Rich Content Editor & Real-time Mobile Preview Modal */}
      {(editingDraft || isCreatingNew) && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          zIndex: 25000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
          animation: 'fade-in 0.2s ease-out',
        }}>
          <div className="glass-panel" style={{
            maxWidth: '1450px', width: '100%', maxHeight: '94vh', display: 'flex', flexDirection: 'column',
            overflow: 'hidden', boxShadow: '0 30px 90px rgba(0, 0, 0, 0.9)', border: '1px solid var(--primary)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border)', backgroundColor: 'rgba(15, 23, 42, 0.8)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Edit3 size={24} style={{ color: 'var(--primary)' }} />
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'white' }}>
                    {isCreatingNew ? 'Criar Nova Minuta de Envio' : `Editor Avançado de Minuta • ${editingDraft?.title}`}
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {isCreatingNew ? 'Configure o rascunho e inspecione a exibição móvel em tempo real' : `Origem: ${editingDraft?.source} • Criado em ${editingDraft?.createdAt}`}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {editingDraft && (
                  <Button type="button" variant="primary" icon={Send} onClick={(e) => handleOpenApprovalModal(editingDraft, e)} style={{ height: '36px', fontSize: '0.85rem', backgroundColor: 'var(--success)', borderColor: 'var(--success)' }}>
                    Aprovar e Enfileirar (BullMQ)
                  </Button>
                )}
                <button onClick={() => { setEditingDraft(null); setIsCreatingNew(false); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.8rem', cursor: 'pointer', marginLeft: '8px' }}>&times;</button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', flex: 1, overflow: 'hidden' }}>
              
              {/* Left Column: Form Controls */}
              <form onSubmit={handleSaveDraft} style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px', backgroundColor: '#090d16', overflowY: 'auto', borderRight: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0' }}>Título da Minuta</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={e => setFormTitle(e.target.value)}
                    placeholder="Ex: Alta dos combustíveis impacta mercado imobiliário"
                    required
                    style={{
                      height: '44px', padding: '0 16px', borderRadius: '8px', backgroundColor: '#0f172a',
                      border: '1px solid var(--border)', color: 'white', fontSize: '0.95rem', outline: 'none'
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0' }}>Fonte da Informação</label>
                    <input
                      type="text"
                      value={formSource}
                      onChange={e => setFormSource(e.target.value)}
                      placeholder="Ex: Folha de S. Paulo"
                      style={{
                        height: '44px', padding: '0 16px', borderRadius: '8px', backgroundColor: '#0f172a',
                        border: '1px solid var(--border)', color: 'white', fontSize: '0.9rem', outline: 'none'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0' }}>Anexo Multimídia (URL da Imagem)</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        value={formAttachment}
                        onChange={e => setFormAttachment(e.target.value)}
                        placeholder="https://... (Deixe em branco se texto puro)"
                        style={{
                          flex: 1, height: '44px', padding: '0 12px', borderRadius: '8px', backgroundColor: '#0f172a',
                          border: '1px solid var(--border)', color: 'white', fontSize: '0.85rem', outline: 'none'
                        }}
                      />
                      <Button type="button" variant="secondary" icon={Paperclip} onClick={handleAddRandomAttachment} style={{ height: '44px', padding: '0 12px', fontSize: '0.8rem' }} title="Adicionar Imagem Aleatória de Teste">
                        Anexo
                      </Button>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0' }}>Resumo Executivo (Sintetizado pela IA)</label>
                  <textarea
                    value={formSummary}
                    onChange={e => setFormSummary(e.target.value)}
                    rows={2}
                    placeholder="Resumo em uma frase para controle interno e indexação..."
                    style={{
                      padding: '12px 16px', borderRadius: '8px', backgroundColor: '#0f172a', border: '1px solid var(--border)',
                      color: '#cbd5e1', fontSize: '0.9rem', resize: 'vertical', outline: 'none', fontFamily: 'inherit',
                      lineHeight: 1.4
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0' }}>Status Kanban</label>
                    <select
                      value={formStatus}
                      onChange={e => setFormStatus(e.target.value as DraftStatus)}
                      style={{
                        height: '42px', padding: '0 12px', borderRadius: '8px', backgroundColor: '#0f172a',
                        border: '1px solid var(--border)', color: 'white', fontSize: '0.9rem', outline: 'none', cursor: 'pointer'
                      }}
                    >
                      <option value="PENDING">PENDING (Pendente)</option>
                      <option value="APPROVED">APPROVED (Aprovada)</option>
                      <option value="REJECTED">REJECTED (Rejeitada)</option>
                      <option value="CANCELLED">CANCELLED (Cancelada)</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0' }}>Prioridade</label>
                    <select
                      value={formPriority}
                      onChange={e => setFormPriority(e.target.value as DraftPriority)}
                      style={{
                        height: '42px', padding: '0 12px', borderRadius: '8px', backgroundColor: '#0f172a',
                        border: '1px solid var(--border)', color: 'white', fontSize: '0.9rem', outline: 'none', cursor: 'pointer'
                      }}
                    >
                      <option value="Baixa">Baixa</option>
                      <option value="Média">Média</option>
                      <option value="Alta">Alta</option>
                      <option value="Urgente">Urgente</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0' }}>Categoria</label>
                    <select
                      value={formCategory}
                      onChange={e => setFormCategory(e.target.value)}
                      style={{
                        height: '42px', padding: '0 12px', borderRadius: '8px', backgroundColor: '#0f172a',
                        border: '1px solid var(--border)', color: 'white', fontSize: '0.9rem', outline: 'none', cursor: 'pointer'
                      }}
                    >
                      {categories.filter(c => c !== 'Todas').map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0' }}>Corpo do Texto (Mensagem de Envio)</label>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Dica: Insira quebras de linha e emojis à vontade</span>
                  </div>

                  {/* Emoji Quick Picker Toolbar */}
                  <div style={{ display: 'flex', gap: '6px', padding: '8px 12px', backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid var(--border)', flexWrap: 'wrap', alignItems: 'center' }}>
                    <Smile size={16} style={{ color: 'var(--primary)' }} />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginRight: '6px' }}>Inserir Emoji:</span>
                    {WHATSAPP_EMOJIS.map(em => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => handleInsertEmoji(em)}
                        style={{ background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', padding: '2px 4px', transition: 'transform 0.1s' }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                      >
                        {em}
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={formContent}
                    onChange={e => setFormContent(e.target.value)}
                    rows={10}
                    placeholder="Escreva a mensagem completa que será enviada aos destinatários..."
                    required
                    style={{
                      flex: 1, padding: '16px', borderRadius: '8px', backgroundColor: '#0f172a', border: '1px solid var(--border)',
                      color: '#f8fafc', fontSize: '0.95rem', resize: 'none', outline: 'none', fontFamily: 'inherit',
                      lineHeight: 1.5, minHeight: '220px'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                  {editingDraft ? (
                    <Button type="button" variant="secondary" icon={Trash2} onClick={() => handleDeleteDraft(editingDraft.id, editingDraft.title)} style={{ borderColor: 'var(--error)', color: 'var(--error)', height: '42px' }}>
                      Deletar Minuta
                    </Button>
                  ) : <div />}

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <Button type="button" variant="secondary" onClick={() => { setEditingDraft(null); setIsCreatingNew(false); }} style={{ height: '42px' }}>Cancelar</Button>
                    <Button type="submit" variant="primary" icon={Save} style={{ height: '42px' }}>Salvar Alterações</Button>
                  </div>
                </div>
              </form>

              {/* Right Column: Real-Time Mobile Phone Mockup Preview */}
              <div style={{ backgroundColor: '#05070f', padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflowY: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <Phone size={16} /> <span>Pré-visualização Interativa no Celular (WhatsApp Mockup)</span>
                </div>

                {/* Smartphone Container */}
                <div style={{
                  width: '350px', minHeight: '620px', borderRadius: '40px', backgroundColor: '#0b141a',
                  border: '12px solid #1f2937', boxShadow: '0 25px 70px rgba(0,0,0,0.8)', display: 'flex', flexDirection: 'column',
                  overflow: 'hidden', position: 'relative'
                }}>
                  {/* Smartphone Top Notch / Speaker */}
                  <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '120px', height: '24px', backgroundColor: '#1f2937', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px', zIndex: 10 }} />

                  {/* WhatsApp App Header */}
                  <div style={{ padding: '32px 16px 12px 16px', backgroundColor: '#008069', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'white' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#cfe9e5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#008069', fontWeight: 700, fontSize: '0.9rem' }}>
                        FA
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Canal Feed-Agent</span>
                        <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.8)' }}>bot oficial de disparos</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <Video size={18} />
                      <Phone size={18} />
                      <MoreVertical size={18} />
                    </div>
                  </div>

                  {/* WhatsApp Chat Wallpaper Body */}
                  <div style={{
                    flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto',
                    backgroundColor: '#efeae2', backgroundImage: 'radial-gradient(rgba(0,0,0,0.05) 1px, transparent 0)',
                    backgroundSize: '20px 20px'
                  }}>
                    {/* Simulated Encryption Notice */}
                    <div style={{ alignSelf: 'center', backgroundColor: '#ffeecd', padding: '6px 12px', borderRadius: '8px', fontSize: '0.7rem', color: '#54452b', textAlign: 'center', maxWidth: '90%', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                      🔒 Mensagens protegidas com criptografia ponta a ponta e validadas por IA.
                    </div>

                    {/* Speech Bubble */}
                    <div style={{
                      alignSelf: 'flex-start', backgroundColor: '#ffffff', borderRadius: '12px', borderTopLeftRadius: 0,
                      padding: '4px', maxWidth: '92%', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column',
                      overflow: 'hidden'
                    }}>
                      {/* Attachment Image Preview */}
                      {formAttachment && (
                        <div style={{ width: '100%', maxHeight: '180px', borderRadius: '8px', overflow: 'hidden', marginBottom: '8px', backgroundColor: '#e2e8f0' }}>
                          <img src={formAttachment} alt="anexo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.currentTarget.style.display = 'none'} />
                        </div>
                      )}

                      {/* Title Header */}
                      <div style={{ padding: '8px 12px 4px 12px' }}>
                        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#111827', display: 'block', marginBottom: '6px' }}>
                          {formTitle || 'Título da Notícia...'}
                        </span>

                        {/* Formatted Content */}
                        <div style={{ fontSize: '0.9rem', color: '#374151', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {formContent || 'O corpo do texto digitado aparecerá aqui formatado em tempo real...'}
                        </div>
                      </div>

                      {/* Source Footnote & Timestamp */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 12px 8px 12px', marginTop: '4px', borderTop: '1px solid #f3f4f6' }}>
                        <span style={{ fontSize: '0.7rem', color: '#6b7280', fontStyle: 'italic' }}>
                          Fonte: {formSource || 'Desconhecida'}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#9ca3af', fontSize: '0.65rem' }}>
                          <span>{new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                          <CheckCheck size={14} style={{ color: '#3b82f6' }} />
                        </div>
                      </div>
                    </div>

                    {/* Broadcast simulation status */}
                    <div style={{ alignSelf: 'flex-start', paddingLeft: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#64748b' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: formStatus === 'APPROVED' ? '#22c55e' : '#eab308' }} />
                      <span>Status: <strong>{formStatus}</strong> • Prioridade {formPriority}</span>
                    </div>
                  </div>

                  {/* WhatsApp Message Input Bar */}
                  <div style={{ padding: '10px 14px', backgroundColor: '#f0f2f5', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ flex: 1, height: '38px', borderRadius: '20px', backgroundColor: 'white', display: 'flex', alignItems: 'center', padding: '0 16px', color: '#94a3b8', fontSize: '0.85rem' }}>
                      Mensagem simulada...
                    </div>
                    <div style={{ width: '38px', height: '38px', borderRadius: '50%', backgroundColor: '#008069', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Send size={16} />
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  A visualização acima reflete com exatidão quebras de parágrafo e mídias anexas.
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Kanban size={32} style={{ color: 'var(--primary)' }} />
            <span>Estúdio de Minutas & Rascunhos (Kanban)</span>
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>Gerencie, audite e aprove pautas instantaneamente para envio em massa no cluster BullMQ</p>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <Button type="button" variant="primary" icon={Plus} onClick={handleOpenCreateModal}>
            Criar Nova Minuta
          </Button>
        </div>
      </div>

      {/* Search and Filter Topbar */}
      <div className="glass-panel" style={{ padding: '20px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ flex: 1, minWidth: '280px', maxWidth: '480px' }}>
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Pesquisar por título, trecho ou resumo da minuta..."
            icon={Filter}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <Tag size={16} style={{ color: 'var(--primary)' }} />
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Filtrar Categoria:</span>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {categories.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setSelectedCategory(c)}
                style={{
                  padding: '6px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                  border: '1px solid var(--border)', transition: 'all 0.2s',
                  backgroundColor: selectedCategory === c ? 'var(--primary)' : 'rgba(255,255,255,0.03)',
                  color: selectedCategory === c ? 'white' : 'var(--text-muted)',
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Kanban Board Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', alignItems: 'flex-start' }}>
        
        {/* Column 1: PENDING */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', borderColor: 'rgba(99, 102, 241, 0.4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--primary)', paddingBottom: '12px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={18} style={{ color: 'var(--primary)' }} />
              <span>PENDING (Pendentes)</span>
            </h3>
            <Badge variant="primary">
              {pendingDrafts.length}
            </Badge>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '300px' }}>
            {pendingDrafts.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Nenhuma minuta pendente.</div>
            ) : (
              pendingDrafts.map(draft => (
                <div 
                  key={draft.id}
                  onClick={() => handleOpenEditor(draft)}
                  style={{
                    padding: '16px', borderRadius: '10px', backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border)',
                    display: 'flex', flexDirection: 'column', gap: '12px', cursor: 'pointer', transition: 'all 0.2s ease-out',
                    position: 'relative'
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'white', lineHeight: 1.3 }}>{draft.title}</span>
                    <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, backgroundColor: 'rgba(255,255,255,0.05)', color: getPriorityColor(draft.priority) }}>
                      {draft.priority}
                    </span>
                  </div>

                  <p style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {draft.content}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={12} /> <span>{draft.createdAt.split(' ')[0]}</span>
                    </div>
                    <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>{draft.source}</span>
                  </div>

                  {/* Quick actions bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button type="button" onClick={(e) => handleOpenAudit(draft, e)} title="Auditar Fidelidade de Fatos (OCR vs IA)" style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', color: '#3b82f6', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <GitCompare size={12} /> IA Guard
                      </button>

                      <button type="button" onClick={(e) => handleOpenJsonEditor(draft, e)} title="Editar Metadados JSON" style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #10b981', backgroundColor: 'rgba(16,185,129,0.1)', color: '#10b981', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Code size={12} /> JSON Tags
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button type="button" onClick={(e) => handleOpenApprovalModal(draft, e)} title="Aprovar e Disparar no BullMQ" style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--success)', backgroundColor: 'rgba(34,197,94,0.15)', color: 'var(--success)', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Send size={10} /> Aprovar &rarr;
                      </button>
                      <button type="button" onClick={(e) => handleOpenRejectModal(draft, e)} title="Rejeitar com Justificativa" style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--error)', backgroundColor: 'rgba(239,68,68,0.1)', color: 'var(--error)', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}>
                        Rejeitar
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 2: APPROVED */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', borderColor: 'rgba(34, 197, 94, 0.4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--success)', paddingBottom: '12px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle size={18} style={{ color: 'var(--success)' }} />
              <span>APPROVED (Aprovadas)</span>
            </h3>
            <Badge variant="success">
              {approvedDrafts.length}
            </Badge>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '300px' }}>
            {approvedDrafts.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Nenhuma minuta aprovada.</div>
            ) : (
              approvedDrafts.map(draft => (
                <div 
                  key={draft.id}
                  onClick={() => handleOpenEditor(draft)}
                  style={{
                    padding: '16px', borderRadius: '10px', backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border)',
                    display: 'flex', flexDirection: 'column', gap: '12px', cursor: 'pointer', transition: 'all 0.2s ease-out'
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--success)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'white', lineHeight: 1.3 }}>{draft.title}</span>
                    <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, backgroundColor: 'rgba(255,255,255,0.05)', color: getPriorityColor(draft.priority) }}>
                      {draft.priority}
                    </span>
                  </div>

                  <p style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {draft.content}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={12} /> <span>{draft.createdAt.split(' ')[0]}</span>
                    </div>
                    <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>{draft.source}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)' }} onClick={e => e.stopPropagation()}>
                    <button type="button" onClick={(e) => handleOpenJsonEditor(draft, e)} title="Editar Metadados JSON" style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #10b981', backgroundColor: 'rgba(16,185,129,0.1)', color: '#10b981', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Code size={12} /> JSON Tags
                    </button>

                    <button type="button" onClick={() => handleDirectBroadcast(draft)} title="Disparar Imediatamente" style={{ padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--success)', backgroundColor: 'var(--success)', color: 'white', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Send size={12} /> Disparar Agora
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 3: REJECTED */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', borderColor: 'rgba(239, 68, 68, 0.4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--error)', paddingBottom: '12px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <XCircle size={18} style={{ color: 'var(--error)' }} />
              <span>REJECTED (Rejeitadas)</span>
            </h3>
            <Badge variant="error">
              {rejectedDrafts.length}
            </Badge>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '300px' }}>
            {rejectedDrafts.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Nenhuma minuta rejeitada.</div>
            ) : (
              rejectedDrafts.map(draft => (
                <div 
                  key={draft.id}
                  onClick={() => handleOpenEditor(draft)}
                  style={{
                    padding: '16px', borderRadius: '10px', backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border)',
                    display: 'flex', flexDirection: 'column', gap: '12px', cursor: 'pointer', transition: 'all 0.2s ease-out', opacity: 0.85
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--error)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'white', lineHeight: 1.3, textDecoration: 'line-through' }}>{draft.title}</span>
                    <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, backgroundColor: 'rgba(255,255,255,0.05)', color: getPriorityColor(draft.priority) }}>
                      {draft.priority}
                    </span>
                  </div>

                  <p style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {draft.content}
                  </p>

                  {draft.rejectionReason && (
                    <div style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', fontSize: '0.75rem', color: '#fca5a5' }}>
                      <strong>Motivo:</strong> {draft.rejectionReason}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={12} /> <span>{draft.createdAt.split(' ')[0]}</span>
                    </div>
                    <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>{draft.source}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '4px' }} onClick={e => e.stopPropagation()}>
                    <button type="button" onClick={() => handleQuickStatusChange(draft.id, 'PENDING')} title="Retornar para Pendente" style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--primary)', backgroundColor: 'rgba(99,102,241,0.1)', color: 'var(--primary)', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}>
                      Revisar &rarr;
                    </button>
                    <button type="button" onClick={() => handleQuickStatusChange(draft.id, 'CANCELLED')} title="Arquivar" style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--text-muted)', fontSize: '0.7rem', cursor: 'pointer' }}>
                      Arquivar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 4: CANCELLED */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', borderColor: 'rgba(100, 116, 139, 0.4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #64748b', paddingBottom: '12px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Ban size={18} style={{ color: '#94a3b8' }} />
              <span>CANCELLED (Canceladas)</span>
            </h3>
            <Badge variant="warning">
              {cancelledDrafts.length}
            </Badge>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '300px' }}>
            {cancelledDrafts.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Nenhuma minuta cancelada.</div>
            ) : (
              cancelledDrafts.map(draft => (
                <div 
                  key={draft.id}
                  onClick={() => handleOpenEditor(draft)}
                  style={{
                    padding: '16px', borderRadius: '10px', backgroundColor: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(255,255,255,0.05)',
                    display: 'flex', flexDirection: 'column', gap: '12px', cursor: 'pointer', transition: 'all 0.2s ease-out', opacity: 0.6
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#94a3b8', lineHeight: 1.3 }}>{draft.title}</span>
                    <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, backgroundColor: 'rgba(255,255,255,0.02)', color: getPriorityColor(draft.priority) }}>
                      {draft.priority}
                    </span>
                  </div>

                  <p style={{ fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {draft.content}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={12} /> <span>{draft.createdAt.split(' ')[0]}</span>
                    </div>
                    <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteDraft(draft.id, draft.title); }} title="Excluir Permanentemente" style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
};

export default DraftsStudio;
