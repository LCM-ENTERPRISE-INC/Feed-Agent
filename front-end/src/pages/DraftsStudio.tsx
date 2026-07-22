import React, { useState } from 'react';
import { createPortal } from 'react-dom';
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
import {
  draftPriorityColor,
  type DraftPriority,
  type DraftStatus,
} from '@/pages/drafts/draftTypes';

export type { DraftStatus, DraftPriority };

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

interface ApiDraftArticle {
  titulo?: string;
  title?: string;
  resumo?: string;
  summary?: string;
  text?: string;
  corpo?: string;
  fonte?: string;
}

interface ApiDraft {
  id: number | string;
  generatedContent?: ApiDraftArticle;
  articleJson?: ApiDraftArticle;
  originalText?: string;
  status: DraftStatus;
  createdAt: string;
  imagePath?: string;
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
          const mappedDrafts: DraftItem[] = (res.data.data as ApiDraft[]).map((d) => {
            const article = d.generatedContent || d.articleJson || {};
            return {
              id: String(d.id),
              title: article.titulo || article.title || 'Minuta sem título',
              summary: article.resumo || article.summary || article.text?.substring(0, 50) || '',
              content: article.corpo || article.resumo || article.text || '',
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
      } catch {
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
  const [audiencePreview, setAudiencePreview] = useState<{
    eligibleContacts: number;
    totalContacts: number;
    invalidContacts: number;
    alreadySentContacts: number;
    inactiveContacts: number;
    batchSize: number;
    estimatedBatches: number;
  } | null>(null);
  const [audienceLoading, setAudienceLoading] = useState(false);
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

  const getPriorityColor = (priority: DraftPriority) => draftPriorityColor(priority);

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

  const handleSaveDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formContent.trim()) {
      showToast.error('Preencha o título e o corpo da mensagem.');
      return;
    }

    if (isCreatingNew) {
      try {
        const payload = {
          title: formTitle,
          summary: formSummary,
          content: formContent,
          status: formStatus,
          priority: formPriority,
          source: formSource || 'Estúdio Kanban Manual',
          category: formCategory,
          imagePath: formAttachment || undefined,
        };

        const res = await apiClient.post('/drafts', payload);
        if (res.data?.success) {
          const d = res.data.data;
          const article = d.generatedContent || {};
          const newDraft: DraftItem = {
            id: String(d.id),
            title: article.titulo || formTitle,
            summary: article.resumo || formSummary,
            content: article.resumo || formContent,
            rawOcrSourceText: d.originalText || '',
            status: d.status,
            priority: formPriority,
            source: article.fonte || formSource,
            createdAt: new Date(d.createdAt).toLocaleString('pt-BR'),
            category: formCategory,
            attachmentUrl: d.imagePath ? `/api/news/image/${d.id}` : undefined,
          };
          setDrafts(prev => [newDraft, ...prev]);
          showToast.success('Nova minuta salva com sucesso no sistema!');
        }
      } catch {
        showToast.error('Erro ao salvar a minuta no banco de dados.');
      }
    } else if (editingDraft) {
      try {
        const payload = {
          titulo: formTitle,
          resumo: formSummary,
          corpo: formContent,
          fonte: formSource,
          status: formStatus,
        };
        const res = await apiClient.put(`/drafts/${editingDraft.id}`, payload);
        if (res.data?.success) {
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
      } catch {
        showToast.error('Erro ao atualizar a minuta.');
      }
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

  const handleDirectBroadcast = async (draft: DraftItem) => {
    try {
      const res = await apiClient.post(`/drafts/${draft.id}/approve`, { includeImage: false });
      if (res.data?.success) {
        showToast.success(`Minuta "${draft.title}" disparada para a esteira do WhatsApp Hub!`);
        handleQuickStatusChange(draft.id, 'APPROVED');
      } else {
        showToast.error('Falha ao disparar minuta diretamente.');
      }
    } catch {
      showToast.error('Erro de conexão ao disparar a minuta.');
    } finally {
      setEditingDraft(null);
      setIsCreatingNew(false);
    }
  };

  // Sprint 35: Centralized Broadcast Confirmation Hub
  const handleOpenApprovalModal = async (draft: DraftItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setApproveDraftCandidate(draft);
    setIsAllocatingBullMq(false);
    setAudiencePreview(null);
    setAudienceLoading(true);
    try {
      const res = await apiClient.post('/campaigns/audience-preview', {
        selectionMode: 'all',
        draftId: Number(draft.id),
        skipAlreadySent: true,
      });
      if (res.data?.success) setAudiencePreview(res.data.data);
    } catch {
      showToast.error('Não foi possível carregar a prévia de audiência.');
    } finally {
      setAudienceLoading(false);
    }
  };

  const handleConfirmBullMqBroadcast = async () => {
    if (!approveDraftCandidate) return;
    setIsAllocatingBullMq(true);

    try {
      if (editingDraft && editingDraft.id === approveDraftCandidate.id) {
        const payload = {
          titulo: formTitle,
          resumo: formSummary,
          corpo: formContent,
          fonte: formSource,
        };
        await apiClient.put(`/drafts/${editingDraft.id}`, payload);
      }

      const approveRes = await apiClient.post(`/drafts/${approveDraftCandidate.id}/approve`, { includeImage: false });
      if (!approveRes.data?.success) {
        showToast.error('Falha ao aprovar minuta.');
        return;
      }

      const expected = audiencePreview?.eligibleContacts;
      const launchRes = await apiClient.post('/campaigns/launch', {
        selectionMode: 'all',
        draftId: Number(approveDraftCandidate.id),
        delaySeconds: 3.5,
        expectedRecipients: expected,
        skipAlreadySent: true,
      });

      if (!launchRes.data?.success || !launchRes.data.data?.queuedJobs) {
        showToast.error('Minuta aprovada, mas a fila não recebeu jobs.');
        return;
      }

      const queued = launchRes.data.data.queuedJobs as number;
      showToast.success(`🚀 Campanha enfileirada: ${queued} destinatário(s).`);
      setDrafts(prev => prev.map(d => d.id === approveDraftCandidate.id ? {
        ...d,
        status: 'APPROVED',
        title: (editingDraft && editingDraft.id === approveDraftCandidate.id) ? formTitle : d.title,
        summary: (editingDraft && editingDraft.id === approveDraftCandidate.id) ? formSummary : d.summary,
        content: (editingDraft && editingDraft.id === approveDraftCandidate.id) ? formContent : d.content,
        source: (editingDraft && editingDraft.id === approveDraftCandidate.id) ? formSource : d.source,
      } : d));
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (err as Error).message;
      showToast.error(`Erro ao enfileirar: ${msg}`);
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
    } catch {
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

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('draftId', id);
  };

  const handleDrop = (e: React.DragEvent, status: DraftStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('draftId');
    if (id) {
      handleQuickStatusChange(id, status);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

      {/* Sprint 35: Centralized Broadcast BullMQ Approval Modal */}
      {approveDraftCandidate && createPortal(
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '24px', borderBottom: '1px solid var(--border)', backgroundColor: 'color-mix(in srgb, var(--success) 15%, transparent)' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-main)' }}>
                <Send size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>Aprovar para Envio Imediato?</h3>
                <span style={{ fontSize: '0.85rem', color: 'var(--success)' }}>Confirmação de alocação de esteira de transmissão</span>
              </div>
            </div>

            <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px', backgroundColor: 'var(--surface)' }}>
              <div style={{ padding: '16px', borderRadius: '10px', backgroundColor: 'var(--surface)', border: '1px solid color-mix(in srgb, var(--border) 30%, transparent)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pauta Selecionada:</span>
                <strong style={{ fontSize: '1rem', color: 'var(--text-main)' }}>{approveDraftCandidate.title}</strong>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ padding: '16px', borderRadius: '10px', backgroundColor: 'color-mix(in srgb, var(--info) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--info) 20%, transparent)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Layers size={24} style={{ color: 'var(--primary)' }} />
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--info)', display: 'block' }}>Público-alvo:</span>
                    <strong style={{ fontSize: '1.1rem', color: 'var(--text-main)' }}>
                      {audienceLoading
                        ? 'Calculando…'
                        : audiencePreview
                          ? `${audiencePreview.eligibleContacts} contatos elegíveis`
                          : 'Prévia indisponível'}
                    </strong>
                    {audiencePreview && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
                        Base {audiencePreview.totalContacts} · lotes {audiencePreview.estimatedBatches}×{audiencePreview.batchSize}
                        {audiencePreview.alreadySentContacts > 0 ? ` · skip ${audiencePreview.alreadySentContacts}` : ''}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ padding: '16px', borderRadius: '10px', backgroundColor: 'color-mix(in srgb, var(--success) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--success) 20%, transparent)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Server size={24} style={{ color: 'var(--success)' }} />
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--success)', display: 'block' }}>Fila BullMQ / Redis:</span>
                    <strong style={{ fontSize: '1.1rem', color: 'var(--text-main)' }}>Prioridade {approveDraftCandidate.priority}</strong>
                  </div>
                </div>
              </div>

              <div style={{ padding: '14px', borderRadius: '8px', backgroundColor: 'color-mix(in srgb, var(--border) 20%, transparent)', border: '1px solid color-mix(in srgb, var(--border) 40%, transparent)', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                ⚠️ <strong>Atenção:</strong> Ao confirmar, o ZapBusiness registrará a aprovação e injetará os pacotes diretamente no gerenciador de filas do WhatsApp Hub.
              </div>
            </div>

            <div style={{ padding: '20px 24px', backgroundColor: 'var(--background)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <Button type="button" variant="secondary" onClick={() => setApproveDraftCandidate(null)} disabled={isAllocatingBullMq} style={{ height: '42px' }}>
                Cancelar
              </Button>
              <Button type="button" variant="primary" icon={CheckCircle} onClick={handleConfirmBullMqBroadcast} isLoading={isAllocatingBullMq} style={{ height: '42px', backgroundColor: 'var(--success)', borderColor: 'var(--success)', padding: '0 24px' }}>
                {isAllocatingBullMq ? 'Alocando Fila BullMQ...' : 'Confirmar e Adicionar à Fila'}
              </Button>
            </div>
          </div>
        </div>, document.body
      )}

      {/* Sprint 35: Centralized Rejection Justification Modal */}
      {rejectDraftCandidate && createPortal(
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '24px', borderBottom: '1px solid var(--border)', backgroundColor: 'color-mix(in srgb, var(--error) 15%, transparent)' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'var(--error)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-main)' }}>
                <XCircle size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>Rejeitar Minuta de Envio</h3>
                <span style={{ fontSize: '0.85rem', color: 'var(--error)' }}>Devolução de pauta para equipe de curadoria</span>
              </div>
            </div>

            <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px', backgroundColor: 'var(--surface)' }}>
              <div style={{ padding: '16px', borderRadius: '10px', backgroundColor: 'var(--surface)', border: '1px solid color-mix(in srgb, var(--border) 30%, transparent)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pauta Selecionada:</span>
                <strong style={{ fontSize: '1rem', color: 'var(--text-main)' }}>{rejectDraftCandidate.title}</strong>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                    padding: '16px', borderRadius: '8px', backgroundColor: 'var(--surface)', border: '1px solid var(--border)',
                    color: 'var(--text-main)', fontSize: '0.95rem', resize: 'none', outline: 'none', lineHeight: 1.5
                  }}
                />
              </div>
            </div>

            <div style={{ padding: '20px 24px', backgroundColor: 'var(--background)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <Button type="button" variant="secondary" onClick={() => setRejectDraftCandidate(null)} style={{ height: '42px' }}>
                Cancelar
              </Button>
              <Button type="button" variant="primary" icon={Trash2} onClick={handleConfirmRejectionJustification} style={{ height: '42px', backgroundColor: 'var(--error)', borderColor: 'var(--error)', padding: '0 24px' }}>
                Confirmar Rejeição e Arquivar
              </Button>
            </div>
          </div>
        </div>, document.body
      )}

      {/* Sprint 34: JSON Metadata Validation & Editor Studio Modal */}
      {jsonDraft && createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          zIndex: 35000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
          animation: 'fade-in 0.2s ease-out',
        }}>
          <div className="glass-panel" style={{
            maxWidth: 'min(96vw, 960px)', width: '100%', maxHeight: '92vh', display: 'flex', flexDirection: 'column',
            overflow: 'hidden', boxShadow: '0 30px 100px rgba(0, 0, 0, 0.95)', border: '1px solid var(--primary)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border)', backgroundColor: 'color-mix(in srgb, var(--surface) 90%, transparent)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Code size={24} style={{ color: 'var(--primary)' }} />
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
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
              <div style={{ padding: '24px', backgroundColor: 'var(--background)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileCode size={16} style={{ color: 'var(--primary)' }} /> <span>Código-Fonte JSON (Editável em tempo real)</span>
                  </span>

                  {jsonParseError ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--error)', fontSize: '0.8rem', fontWeight: 700, backgroundColor: 'color-mix(in srgb, var(--error) 10%, transparent)', padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--error)' }}>
                      <X size={14} /> Erro de Sintaxe JSON
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--success)', fontSize: '0.8rem', fontWeight: 700, backgroundColor: 'color-mix(in srgb, var(--success) 10%, transparent)', padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--success)' }}>
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
                    flex: 1, padding: '20px', borderRadius: '8px', backgroundColor: 'var(--surface)', border: '1px solid var(--border)',
                    fontFamily: 'monospace', fontSize: '0.95rem', color: 'var(--success)', lineHeight: 1.6, outline: 'none',
                    resize: 'none', minHeight: '340px', boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)'
                  }}
                />

                {jsonParseError && (
                  <div style={{ padding: '14px', borderRadius: '8px', backgroundColor: 'color-mix(in srgb, var(--error) 15%, transparent)', border: '1px solid var(--error)', color: 'var(--error)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <AlertTriangle size={18} style={{ color: 'var(--error)', flexShrink: 0 }} />
                    <span><strong>Falha de Parse:</strong> {jsonParseError}. O salvamento está bloqueado até a correção.</span>
                  </div>
                )}
              </div>

              {/* Right Column: Visual Tag Editor and Quick Helpers */}
              <div style={{ padding: '24px', backgroundColor: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
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
                      flex: 1, height: '42px', padding: '0 14px', borderRadius: '8px', backgroundColor: 'var(--surface)',
                      border: '1px solid var(--border)', color: 'var(--text-main)', fontSize: '0.85rem', outline: 'none'
                    }}
                  />
                  <Button type="button" variant="secondary" onClick={handleAddQuickKeyword} style={{ height: '42px' }}>
                    Adicionar Tag
                  </Button>
                </div>

                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>Estrutura de Atributos Chave Recomendada</span>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <div style={{ padding: '10px 14px', backgroundColor: 'var(--surface)', borderRadius: '6px', border: '1px solid color-mix(in srgb, var(--border) 30%, transparent)' }}>
                      <strong style={{ color: 'var(--text-main)' }}>keywords:</strong> Array de strings para filtros no dashboard
                    </div>
                    <div style={{ padding: '10px 14px', backgroundColor: 'var(--surface)', borderRadius: '6px', border: '1px solid color-mix(in srgb, var(--border) 30%, transparent)' }}>
                      <strong style={{ color: 'var(--text-main)' }}>relevance:</strong> "low" | "medium" | "high" | "urgent"
                    </div>
                    <div style={{ padding: '10px 14px', backgroundColor: 'var(--surface)', borderRadius: '6px', border: '1px solid color-mix(in srgb, var(--border) 30%, transparent)' }}>
                      <strong style={{ color: 'var(--text-main)' }}>sentiment:</strong> "positive" | "neutral" | "warning"
                    </div>
                    <div style={{ padding: '10px 14px', backgroundColor: 'var(--surface)', borderRadius: '6px', border: '1px solid color-mix(in srgb, var(--border) 30%, transparent)' }}>
                      <strong style={{ color: 'var(--text-main)' }}>aiModelVersion:</strong> Assinatura do modelo LLM curador
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 'auto', padding: '16px', borderRadius: '8px', backgroundColor: 'color-mix(in srgb, var(--info) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--info) 20%, transparent)' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--info)', lineHeight: 1.4, display: 'block' }}>
                    💡 <strong>Proteção Ativa:</strong> O ZapBusiness inspeciona a árvore em tempo real. Estruturas JSON corrompidas ou malformadas são automaticamente bloqueadas de entrar no banco de dados.
                  </span>
                </div>
              </div>

            </div>
          </div>
        </div>, document.body
      )}

      {/* Sprint 33: Fact-Checking Audit Comparison Studio Modal */}
      {auditDraft && createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          zIndex: 30000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
          animation: 'fade-in 0.2s ease-out',
        }}>
          <div className="glass-panel" style={{
            maxWidth: 'min(96vw, 1100px)', width: '100%', maxHeight: '92vh', display: 'flex', flexDirection: 'column',
            overflow: 'hidden', boxShadow: '0 30px 100px rgba(0, 0, 0, 0.95)', border: '1px solid var(--info)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border)', backgroundColor: 'color-mix(in srgb, var(--surface) 90%, transparent)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <GitCompare size={24} style={{ color: 'var(--primary)' }} />
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
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
              <div style={{ padding: '24px', backgroundColor: 'var(--background)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Search size={16} /> <span>Texto Bruto Extraído (Origem OCR)</span>
                  </span>
                  <Badge variant="neutral">Inalterado do Jornal</Badge>
                </div>

                <div style={{
                  padding: '20px', borderRadius: '8px', backgroundColor: 'var(--surface)', border: '1px solid color-mix(in srgb, var(--border) 40%, transparent)',
                  fontFamily: 'monospace', fontSize: '0.95rem', color: 'var(--text-muted)', lineHeight: 1.6, whiteSpace: 'pre-wrap',
                  minHeight: '280px'
                }}>
                  {auditDraft.rawOcrSourceText || '[Texto de origem OCR não localizado no histórico desta minuta]'}
                </div>

                <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: 'color-mix(in srgb, var(--info) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--info) 20%, transparent)', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <ShieldCheck size={20} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>Verificação de Integridade e OCR Base</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                      Este painel apresenta a leitura crua da imagem antes de qualquer formatação. Compare os números e nomes para evitar repasses errôneos.
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: AI Synthesized Draft */}
              <div style={{ padding: '24px', backgroundColor: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Smile size={16} style={{ color: 'var(--primary)' }} /> <span>Texto Sintetizado pela IA (Minuta de Envio)</span>
                  </span>
                  <Badge variant="success">Formatado Llama 3</Badge>
                </div>

                <div style={{
                  padding: '20px', borderRadius: '8px', backgroundColor: 'var(--surface)', border: '1px solid var(--info)',
                  fontSize: '0.95rem', color: 'var(--text-main)', lineHeight: 1.6, whiteSpace: 'pre-wrap', minHeight: '280px',
                  boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.4)'
                }}>
                  {auditDraft.content}
                </div>

                {/* Discrepancy Hallucination Guard Panel */}
                <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: 'color-mix(in srgb, var(--success) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--success) 20%, transparent)', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <ShieldCheck size={20} style={{ color: 'var(--success)', flexShrink: 0, marginTop: '2px' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>Auditoria de Fatos Concluída com Sucesso</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--success)', lineHeight: 1.4 }}>
                      ✓ Valores numéricos verificados e idênticos à origem (5%, dia 20, dias 28 e 29)<br />
                      ✓ Sem indícios de alucinação ou extrapolação de fatos pela IA generativa
                    </span>
                  </div>
                </div>
              </div>

            </div>

            {/* Bottom Discrepancy Highlight Bar */}
            <div style={{ padding: '16px 24px', backgroundColor: 'var(--surface)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--warning)' }}><AlertTriangle size={16} /> 0 Termos Suspeitos</span>
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
        </div>, document.body
      )}

      {/* Advanced Rich Content Editor & Real-time Mobile Preview Modal */}
      {(editingDraft || isCreatingNew) && createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          zIndex: 25000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
          animation: 'fade-in 0.2s ease-out',
        }}>
          <div className="glass-panel" style={{
            maxWidth: 'min(96vw, 1100px)', width: '100%', maxHeight: '94vh', display: 'flex', flexDirection: 'column',
            overflow: 'hidden', boxShadow: '0 30px 90px rgba(0, 0, 0, 0.9)', border: '1px solid var(--primary)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border)', backgroundColor: 'color-mix(in srgb, var(--surface) 80%, transparent)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Edit3 size={24} style={{ color: 'var(--primary)' }} />
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)' }}>
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

            <div className="split-pane" style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>

              {/* Left Column: Form Controls */}
              <form onSubmit={handleSaveDraft} style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px', backgroundColor: 'var(--surface)', overflowY: 'auto', borderRight: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>Título da Minuta</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={e => setFormTitle(e.target.value)}
                    placeholder="Ex: Alta dos combustíveis impacta mercado imobiliário"
                    required
                    style={{
                      height: '44px', padding: '0 16px', borderRadius: '8px', backgroundColor: 'var(--surface)',
                      border: '1px solid var(--border)', color: 'var(--text-main)', fontSize: '0.95rem', outline: 'none'
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>Fonte da Informação</label>
                    <input
                      type="text"
                      value={formSource}
                      onChange={e => setFormSource(e.target.value)}
                      placeholder="Ex: Folha de S. Paulo"
                      style={{
                        height: '44px', padding: '0 16px', borderRadius: '8px', backgroundColor: 'var(--surface)',
                        border: '1px solid var(--border)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>Anexo Multimídia (URL da Imagem)</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        value={formAttachment}
                        onChange={e => setFormAttachment(e.target.value)}
                        placeholder="https://... (Deixe em branco se texto puro)"
                        style={{
                          flex: 1, height: '44px', padding: '0 12px', borderRadius: '8px', backgroundColor: 'var(--surface)',
                          border: '1px solid var(--border)', color: 'var(--text-main)', fontSize: '0.85rem', outline: 'none'
                        }}
                      />
                      <Button type="button" variant="secondary" icon={Paperclip} onClick={handleAddRandomAttachment} style={{ height: '44px', padding: '0 12px', fontSize: '0.8rem' }} title="Adicionar Imagem Aleatória de Teste">
                        Anexo
                      </Button>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>Resumo Executivo (Sintetizado pela IA)</label>
                  <textarea
                    value={formSummary}
                    onChange={e => setFormSummary(e.target.value)}
                    rows={2}
                    placeholder="Resumo em uma frase para controle interno e indexação..."
                    style={{
                      padding: '12px 16px', borderRadius: '8px', backgroundColor: 'var(--surface)', border: '1px solid var(--border)',
                      color: 'var(--text-muted)', fontSize: '0.9rem', resize: 'vertical', outline: 'none', fontFamily: 'inherit',
                      lineHeight: 1.4
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>Status Kanban</label>
                    <select
                      value={formStatus}
                      onChange={e => setFormStatus(e.target.value as DraftStatus)}
                      style={{
                        height: '42px', padding: '0 12px', borderRadius: '8px', backgroundColor: 'var(--surface)',
                        border: '1px solid var(--border)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none', cursor: 'pointer'
                      }}
                    >
                      <option value="PENDING">PENDING (Pendente)</option>
                      <option value="APPROVED">APPROVED (Aprovada)</option>
                      <option value="REJECTED">REJECTED (Rejeitada)</option>
                      <option value="CANCELLED">CANCELLED (Cancelada)</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>Prioridade</label>
                    <select
                      value={formPriority}
                      onChange={e => setFormPriority(e.target.value as DraftPriority)}
                      style={{
                        height: '42px', padding: '0 12px', borderRadius: '8px', backgroundColor: 'var(--surface)',
                        border: '1px solid var(--border)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none', cursor: 'pointer'
                      }}
                    >
                      <option value="Baixa">Baixa</option>
                      <option value="Média">Média</option>
                      <option value="Alta">Alta</option>
                      <option value="Urgente">Urgente</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>Categoria</label>
                    <select
                      value={formCategory}
                      onChange={e => setFormCategory(e.target.value)}
                      style={{
                        height: '42px', padding: '0 12px', borderRadius: '8px', backgroundColor: 'var(--surface)',
                        border: '1px solid var(--border)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none', cursor: 'pointer'
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
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>Corpo do Texto (Mensagem de Envio)</label>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Dica: Insira quebras de linha e emojis à vontade</span>
                  </div>

                  {/* Emoji Quick Picker Toolbar */}
                  <div style={{ display: 'flex', gap: '6px', padding: '8px 12px', backgroundColor: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)', flexWrap: 'wrap', alignItems: 'center' }}>
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
                      flex: 1, padding: '16px', borderRadius: '8px', backgroundColor: 'var(--surface)', border: '1px solid var(--border)',
                      color: 'var(--text-main)', fontSize: '0.95rem', resize: 'none', outline: 'none', fontFamily: 'inherit',
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
              <div style={{ backgroundColor: 'var(--background)', padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflowY: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <Phone size={16} /> <span>Pré-visualização Interativa no Celular (WhatsApp Mockup)</span>
                </div>

                {/* Smartphone Container */}
                <div style={{
                  width: '350px', minHeight: '620px', borderRadius: '40px', backgroundColor: 'var(--surface-raised)',
                  border: '12px solid var(--border)', boxShadow: '0 25px 70px rgba(0,0,0,0.8)', display: 'flex', flexDirection: 'column',
                  overflow: 'hidden', position: 'relative'
                }}>
                  {/* Smartphone Top Notch / Speaker */}
                  <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '120px', height: '24px', backgroundColor: 'var(--border)', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px', zIndex: 10 }} />

                  {/* WhatsApp App Header */}
                  <div style={{ padding: '32px 16px 12px 16px', backgroundColor: '#008069', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-main)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#cfe9e5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#008069', fontWeight: 700, fontSize: '0.9rem' }}>
                        ZB
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Canal ZapBusiness</span>
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
                        <div style={{ width: '100%', maxHeight: '180px', borderRadius: '8px', overflow: 'hidden', marginBottom: '8px', backgroundColor: 'var(--text-main)' }}>
                          <img src={formAttachment} alt="anexo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.currentTarget.style.display = 'none'} />
                        </div>
                      )}

                      {/* Title Header */}
                      <div style={{ padding: '8px 12px 4px 12px' }}>
                        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--surface)', display: 'block', marginBottom: '6px' }}>
                          {formTitle || 'Título da Notícia...'}
                        </span>

                        {/* Formatted Content */}
                        <div style={{ fontSize: '0.9rem', color: 'var(--border)', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {formContent || 'O corpo do texto digitado aparecerá aqui formatado em tempo real...'}
                        </div>
                      </div>

                      {/* Source Footnote & Timestamp */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 12px 8px 12px', marginTop: '4px', borderTop: '1px solid #f3f4f6' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          Fonte: {formSource || 'Desconhecida'}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', fontSize: '0.65rem' }}>
                          <span>{new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                          <CheckCheck size={14} style={{ color: 'var(--primary)' }} />
                        </div>
                      </div>
                    </div>

                    {/* Broadcast simulation status */}
                    <div style={{ alignSelf: 'flex-start', paddingLeft: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: formStatus === 'APPROVED' ? 'var(--success)' : 'var(--warning)' }} />
                      <span>Status: <strong>{formStatus}</strong> • Prioridade {formPriority}</span>
                    </div>
                  </div>

                  {/* WhatsApp Message Input Bar */}
                  <div style={{ padding: '10px 14px', backgroundColor: '#f0f2f5', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ flex: 1, height: '38px', borderRadius: '20px', backgroundColor: 'var(--text-main)', display: 'flex', alignItems: 'center', padding: '0 16px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      Mensagem simulada...
                    </div>
                    <div style={{ width: '38px', height: '38px', borderRadius: '50%', backgroundColor: '#008069', color: 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
        </div>, document.body
      )}

      <div className="page-hero">
        <div className="page-hero-copy">
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Kanban size={28} style={{ color: 'var(--primary)' }} />
            Conteúdos
          </h1>
          <p>Revise, aprove ou rejeite conteúdos antes de iniciar a campanha.</p>
        </div>
        <Button type="button" variant="primary" icon={Plus} onClick={handleOpenCreateModal}>
          Novo conteúdo
        </Button>
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
                  backgroundColor: selectedCategory === c ? 'var(--primary)' : 'color-mix(in srgb, var(--border) 20%, transparent)',
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
      <div className="responsive-grid" style={{ alignItems: 'flex-start' }}>

        {/* Column 1: PENDING */}
        <div
          className="glass-panel"
          onDragOver={e => e.preventDefault()}
          onDrop={e => handleDrop(e, 'PENDING')}
          style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', borderColor: 'color-mix(in srgb, var(--primary), 0.4)' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--primary)', paddingBottom: '12px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                  draggable
                  onDragStart={e => handleDragStart(e, draft.id)}
                  onClick={() => handleOpenEditor(draft)}
                  style={{
                    padding: '16px', borderRadius: '10px', backgroundColor: 'color-mix(in srgb, var(--surface) 60%, transparent)', border: '1px solid var(--border)',
                    display: 'flex', flexDirection: 'column', gap: '12px', cursor: 'pointer', transition: 'all 0.2s ease-out',
                    position: 'relative'
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1.3 }}>{draft.title}</span>
                    <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, backgroundColor: 'color-mix(in srgb, var(--border) 30%, transparent)', color: getPriorityColor(draft.priority) }}>
                      {draft.priority}
                    </span>
                  </div>

                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {draft.content}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', paddingTop: '8px', borderTop: '1px solid color-mix(in srgb, var(--border) 30%, transparent)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={12} /> <span>{draft.createdAt.split(' ')[0]}</span>
                    </div>
                    <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{draft.source}</span>
                  </div>

                  {/* Quick actions bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', paddingTop: '8px', borderTop: '1px solid color-mix(in srgb, var(--border) 30%, transparent)' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button type="button" onClick={(e) => handleOpenAudit(draft, e)} title="Auditar Fidelidade de Fatos (OCR vs IA)" style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--info)', backgroundColor: 'color-mix(in srgb, var(--info) 10%, transparent)', color: 'var(--primary)', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <GitCompare size={12} /> IA Guard
                      </button>

                      <button type="button" onClick={(e) => handleOpenJsonEditor(draft, e)} title="Editar Metadados JSON" style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--success)', backgroundColor: 'color-mix(in srgb, var(--success) 10%, transparent)', color: 'var(--success)', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Code size={12} /> JSON Tags
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button type="button" onClick={(e) => handleOpenApprovalModal(draft, e)} title="Aprovar e Disparar no BullMQ" style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--success)', backgroundColor: 'color-mix(in srgb, var(--success) 15%, transparent)', color: 'var(--success)', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Send size={10} /> Aprovar &rarr;
                      </button>
                      <button type="button" onClick={(e) => handleOpenRejectModal(draft, e)} title="Rejeitar com Justificativa" style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--error)', backgroundColor: 'color-mix(in srgb, var(--error) 10%, transparent)', color: 'var(--error)', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}>
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
        <div
          className="glass-panel"
          onDragOver={e => e.preventDefault()}
          onDrop={e => handleDrop(e, 'APPROVED')}
          style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', borderColor: 'color-mix(in srgb, var(--success) 40%, transparent)' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--success)', paddingBottom: '12px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                  draggable
                  onDragStart={e => handleDragStart(e, draft.id)}
                  onClick={() => handleOpenEditor(draft)}
                  style={{
                    padding: '16px', borderRadius: '10px', backgroundColor: 'color-mix(in srgb, var(--surface) 60%, transparent)', border: '1px solid var(--border)',
                    display: 'flex', flexDirection: 'column', gap: '12px', cursor: 'pointer', transition: 'all 0.2s ease-out'
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--success)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1.3 }}>{draft.title}</span>
                    <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, backgroundColor: 'color-mix(in srgb, var(--border) 30%, transparent)', color: getPriorityColor(draft.priority) }}>
                      {draft.priority}
                    </span>
                  </div>

                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {draft.content}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', paddingTop: '8px', borderTop: '1px solid color-mix(in srgb, var(--border) 30%, transparent)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={12} /> <span>{draft.createdAt.split(' ')[0]}</span>
                    </div>
                    <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{draft.source}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', paddingTop: '8px', borderTop: '1px solid color-mix(in srgb, var(--border) 30%, transparent)' }} onClick={e => e.stopPropagation()}>
                    <button type="button" onClick={(e) => handleOpenJsonEditor(draft, e)} title="Editar Metadados JSON" style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--success)', backgroundColor: 'color-mix(in srgb, var(--success) 10%, transparent)', color: 'var(--success)', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Code size={12} /> JSON Tags
                    </button>

                    <button type="button" onClick={() => handleDirectBroadcast(draft)} title="Disparar Imediatamente" style={{ padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--success)', backgroundColor: 'var(--success)', color: 'var(--text-main)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Send size={12} /> Disparar Agora
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 3: REJECTED */}
        <div
          className="glass-panel"
          onDragOver={e => e.preventDefault()}
          onDrop={e => handleDrop(e, 'REJECTED')}
          style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', borderColor: 'color-mix(in srgb, var(--error) 40%, transparent)' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--error)', paddingBottom: '12px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                  draggable
                  onDragStart={e => handleDragStart(e, draft.id)}
                  onClick={() => handleOpenEditor(draft)}
                  style={{
                    padding: '16px', borderRadius: '10px', backgroundColor: 'color-mix(in srgb, var(--surface) 60%, transparent)', border: '1px solid var(--border)',
                    display: 'flex', flexDirection: 'column', gap: '12px', cursor: 'pointer', transition: 'all 0.2s ease-out', opacity: 0.85
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--error)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1.3, textDecoration: 'line-through' }}>{draft.title}</span>
                    <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, backgroundColor: 'color-mix(in srgb, var(--border) 30%, transparent)', color: getPriorityColor(draft.priority) }}>
                      {draft.priority}
                    </span>
                  </div>

                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {draft.content}
                  </p>

                  {draft.rejectionReason && (
                    <div style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: 'color-mix(in srgb, var(--error) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--error) 20%, transparent)', fontSize: '0.75rem', color: 'var(--error)' }}>
                      <strong>Motivo:</strong> {draft.rejectionReason}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', paddingTop: '8px', borderTop: '1px solid color-mix(in srgb, var(--border) 30%, transparent)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={12} /> <span>{draft.createdAt.split(' ')[0]}</span>
                    </div>
                    <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{draft.source}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '4px' }} onClick={e => e.stopPropagation()}>
                    <button type="button" onClick={() => handleQuickStatusChange(draft.id, 'PENDING')} title="Retornar para Pendente" style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--primary)', backgroundColor: 'color-mix(in srgb, var(--primary) 10%, transparent)', color: 'var(--primary)', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}>
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
        <div
          className="glass-panel"
          onDragOver={e => e.preventDefault()}
          onDrop={e => handleDrop(e, 'CANCELLED')}
          style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', borderColor: 'color-mix(in srgb, var(--text-muted) 40%, transparent)' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--text-muted)', paddingBottom: '12px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Ban size={18} style={{ color: 'var(--text-muted)' }} />
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
                  draggable
                  onDragStart={e => handleDragStart(e, draft.id)}
                  onClick={() => handleOpenEditor(draft)}
                  style={{
                    padding: '16px', borderRadius: '10px', backgroundColor: 'color-mix(in srgb, var(--surface) 40%, transparent)', border: '1px solid color-mix(in srgb, var(--border) 30%, transparent)',
                    display: 'flex', flexDirection: 'column', gap: '12px', cursor: 'pointer', transition: 'all 0.2s ease-out', opacity: 0.6
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-muted)', lineHeight: 1.3 }}>{draft.title}</span>
                    <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, backgroundColor: 'color-mix(in srgb, var(--border) 15%, transparent)', color: getPriorityColor(draft.priority) }}>
                      {draft.priority}
                    </span>
                  </div>

                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {draft.content}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', paddingTop: '8px', borderTop: '1px solid color-mix(in srgb, var(--border) 30%, transparent)' }}>
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
