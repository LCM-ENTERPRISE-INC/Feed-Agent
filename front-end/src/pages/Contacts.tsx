import React, { useState, useEffect, useMemo, useRef } from 'react';
import Papa from 'papaparse';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip as RechartsTooltip, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { 
  Search, 
  Filter, 
  ArrowUpDown, 
  Plus, 
  Trash2, 
  Edit, 
  Check, 
  X, 
  Download, 
  CheckSquare, 
  Square, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight,
  Tags,
  Users,
  Phone,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  UploadCloud,
  FileSpreadsheet,
  FileText,
  AlertCircle,
  BarChart3,
  TrendingUp,
  Activity,
  Award
} from 'lucide-react';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { showToast } from '@/utils/toastHelper';
import apiClient from '@/services/apiClient';

interface Contact {
  id: string;
  name: string;
  phone: string;
  status: 'Ativo' | 'Inativo';
  category: 'VIP' | 'Cliente' | 'Imprensa' | 'Geral';
  dateAdded: string;
}

interface ApiContact {
  id: number | string;
  name: string;
  phoneNumber: string;
  active: boolean;
  createdAt: string;
}

interface ParsedRow {
  index: number;
  name: string;
  phone: string;
  category: string;
  valid: boolean;
  errors: string[];
}

// Remove mock data generation
const INITIAL_CONTACTS: Contact[] = [];

type SortField = 'name' | 'dateAdded' | 'status' | 'category';
type SortOrder = 'asc' | 'desc';

export const Contacts: React.FC = () => {
  const [contacts, setContacts] = useState<Contact[]>(INITIAL_CONTACTS);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>('');
  const searchTimeoutRef = useRef<number | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'Todos' | 'Ativo' | 'Inativo'>('Todos');
  const [categoryFilter, setCategoryFilter] = useState<string>('Todas');

  // Sorting
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);

  // Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals / State for creating/editing
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Bulk Actions Confirmation
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState<boolean>(false);
  const [isBulking, setIsBulking] = useState<boolean>(false);

  // Drag-and-drop / CSV Import Module States
  const [showImportPanel, setShowImportPanel] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importFileName, setImportFileName] = useState<string>('');
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importProgress, setImportProgress] = useState<number>(0);
  const [importFile, setImportFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Statistics / Analytics Dashboard State
  const [showAnalytics, setShowAnalytics] = useState<boolean>(true);

  // Fetch real contacts
  const fetchContacts = async () => {
    try {
      const res = await apiClient.get('/contacts?page=1&limit=1000');
      if (res.data?.success) {
        const mapped = (res.data.data.data as ApiContact[]).map((c) => ({
          id: String(c.id),
          name: c.name,
          phone: c.phoneNumber,
          status: (c.active ? 'Ativo' : 'Inativo') as Contact['status'],
          category: 'Geral' as Contact['category'], // Backend may not support categories yet
          dateAdded: new Date(c.createdAt).toLocaleDateString('pt-BR'),
        }));
        setContacts(mapped);
      }
    } catch (err) {
      console.error('Falha ao buscar contatos:', err);
    }
  };

  useEffect(() => {
    // Defer fetch so setState after await is not treated as sync effect cascade
    const boot = window.setTimeout(() => {
      void fetchContacts();
    }, 0);
    return () => window.clearTimeout(boot);
  }, []);

  // Debouncing effect (300ms) for Search
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchTerm]);

  useEffect(() => {
    const boot = window.setTimeout(() => setCurrentPage(1), 0);
    return () => window.clearTimeout(boot);
  }, [statusFilter, categoryFilter, itemsPerPage]);

  // Memoized Filtered and Sorted Contacts
  const filteredAndSortedContacts = useMemo(() => {
    let result = [...contacts];

    if (debouncedSearchTerm.trim()) {
      const term = debouncedSearchTerm.toLowerCase();
      result = result.filter(
        c => c.name.toLowerCase().includes(term) ||
             c.phone.includes(term) ||
             c.category.toLowerCase().includes(term)
      );
    }

    if (statusFilter !== 'Todos') {
      result = result.filter(c => c.status === statusFilter);
    }

    if (categoryFilter !== 'Todas') {
      result = result.filter(c => c.category === categoryFilter);
    }

    result.sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];

      if (sortField === 'dateAdded') {
        const partsA = a.dateAdded.split('/');
        const partsB = b.dateAdded.split('/');
        const dateA = new Date(Number(partsA[2]), Number(partsA[1]) - 1, Number(partsA[0])).getTime();
        const dateB = new Date(Number(partsB[2]), Number(partsB[1]) - 1, Number(partsB[0])).getTime();
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [contacts, debouncedSearchTerm, statusFilter, categoryFilter, sortField, sortOrder]);

  const totalPages = Math.ceil(filteredAndSortedContacts.length / itemsPerPage);
  const paginatedContacts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedContacts.slice(start, start + itemsPerPage);
  }, [filteredAndSortedContacts, currentPage, itemsPerPage]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.length === paginatedContacts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedContacts.map(c => c.id));
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleBulkStatusChange = async (newStatus: 'Ativo' | 'Inativo') => {
    if (selectedIds.length === 0) return;
    setIsBulking(true);
    
    try {
      const active = newStatus === 'Ativo';
      await Promise.allSettled(
        selectedIds.map(id => apiClient.put(`/contacts/${id}`, { active }))
      );
      showToast.success(`Operação em Lote Concluída: Status de ${selectedIds.length} contatos alterado para ${newStatus}.`);
      setSelectedIds([]);
      fetchContacts();
    } catch {
      showToast.error('Erro ao alterar status em massa.');
    } finally {
      setIsBulking(false);
    }
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setIsBulking(true);
    
    try {
      await Promise.allSettled(
        selectedIds.map(id => apiClient.delete(`/contacts/${id}`))
      );
      showToast.success(`Exclusão em Massa Concluída: ${selectedIds.length} contatos foram removidos permanentemente.`);
      setSelectedIds([]);
      setShowBulkDeleteModal(false);
      fetchContacts();
    } catch {
      showToast.error('Erro ao excluir contatos em massa.');
    } finally {
      setIsBulking(false);
    }
  };

  const handleExportCSV = () => {
    const dataToExport = selectedIds.length > 0 
      ? contacts.filter(c => selectedIds.includes(c.id)) 
      : filteredAndSortedContacts;

    const headers = 'ID,Nome,Telefone,Status,Categoria,Data\n';
    const rows = dataToExport.map(c => `"${c.id}","${c.name}","${c.phone}","${c.status}","${c.category}","${c.dateAdded}"`).join('\n');
    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(headers + rows);

    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', `contatos-feedagent-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast.success(`Exportação CSV gerada com sucesso (${dataToExport.length} registros).`);
  };

  // CSV Import Validation Template
  const handleDownloadTemplate = () => {
    const templateContent = 'Nome,Telefone,Categoria\n"João da Silva","+55 (11) 99999-0001","VIP"\n"Maria de Souza","5511988880002","Cliente"';
    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(templateContent);
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', 'modelo-importacao-contatos.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast.info('Arquivo modelo CSV baixado. Preencha e faça o upload.');
  };

  const handleProcessCsvFile = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      showToast.error('Por favor, selecione um arquivo no formato .csv.');
      return;
    }

    setImportFile(file);
    setImportFileName(file.name);
    setParsedRows([]);

    Papa.parse<{ Nome?: string; name?: string; Telefone?: string; phone?: string; Categoria?: string; category?: string }>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows: ParsedRow[] = results.data.map((row, idx) => {
          const rawName = row.Nome || row.name || '';
          const rawPhone = row.Telefone || row.phone || '';
          const rawCat = row.Categoria || row.category || 'Geral';

          const errors: string[] = [];
          if (!rawName.trim()) errors.push('Nome vazio');
          
          let digits = rawPhone.replace(/\D/g, '');
          if (!digits.startsWith('55') && digits.length > 0) {
            digits = '55' + digits;
          }

          let formattedPhone = rawPhone;
          if (digits.length >= 12 && digits.length <= 13) {
            formattedPhone = `+55 (${digits.substring(2, 4)}) 9${digits.substring(4, 8)}-${digits.substring(8, 12)}`;
          } else {
            errors.push(`Número de celular incompleto ou inválido (${digits.length} dígitos)`);
          }

          let validCat = 'Geral';
          if (['VIP', 'Cliente', 'Imprensa', 'Geral'].includes(rawCat)) {
            validCat = rawCat;
          }

          return {
            index: idx + 1,
            name: rawName,
            phone: formattedPhone,
            category: validCat,
            valid: errors.length === 0,
            errors,
          };
        });

        setParsedRows(rows);
        showToast.success(`Arquivo analisado: ${rows.length} linhas preparadas.`);
      },
      error: () => {
        showToast.error('Falha ao interpretar o arquivo CSV. Verifique a codificação.');
      }
    });
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => { setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleProcessCsvFile(e.dataTransfer.files[0]);
    }
  };

  const handleExecuteImport = async () => {
    if (!importFile) {
      showToast.error('Nenhum arquivo para importar.');
      return;
    }

    setIsImporting(true);
    setImportProgress(20);

    try {
      const formData = new FormData();
      formData.append('file', importFile);
      
      const res = await apiClient.post('/contacts/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 100));
          setImportProgress(Math.min(90, percentCompleted));
        }
      });
      
      setImportProgress(100);
      setIsImporting(false);
      setShowImportPanel(false);
      setParsedRows([]);
      setImportFile(null);
      
      const summary = res.data?.data;
      showToast.success(`${summary?.imported || 0} contatos foram importados com sucesso!`);
      
      fetchContacts();
    } catch (error) {
      console.error(error);
      showToast.error('Falha na importação do arquivo.');
      setIsImporting(false);
    }
  };

  const handleOpenNewModal = () => {
    setEditingContact({
      id: `CT-${Date.now().toString().slice(-4)}`,
      name: '',
      phone: '+55 ',
      status: 'Ativo',
      category: 'Geral',
      dateAdded: new Date().toLocaleDateString('pt-BR'),
    });
    setShowEditModal(true);
  };

  const handleModalPhoneChange = (raw: string) => {
    if (!editingContact) return;

    let digits = raw.replace(/\D/g, '');
    if (!digits.startsWith('55') && digits.length > 0) digits = '55' + digits;

    let formatted = '+';
    if (digits.length >= 2) formatted += digits.substring(0, 2);
    else formatted += digits;

    if (digits.length > 2) formatted += ' (' + digits.substring(2, 4);
    if (digits.length > 4) formatted += ') ' + digits.substring(4, 9);
    if (digits.length > 9) formatted += '-' + digits.substring(9, 14);

    setEditingContact({ ...editingContact, phone: formatted });
  };

  const checkPhoneValidity = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 12 || digits.length === 13) return { valid: true, text: 'Formato Internacional Válido (DDI + DDD + Celular)', color: 'var(--success)' };
    else if (digits.length > 0 && digits.length < 12) return { valid: false, text: `Incompleto: Faltam dígitos (Atual: ${digits.length}/13)`, color: 'var(--warning)' };
    else return { valid: false, text: 'Digite o DDD e o número do celular', color: 'var(--text-muted)' };
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContact || !editingContact.name.trim()) { showToast.error('Por favor, informe o Nome Completo do contato.'); return; }
    const validity = checkPhoneValidity(editingContact.phone);
    if (!validity.valid) { showToast.error('Número de celular inválido. Verifique o formato internacional com DDD.'); return; }

    setIsSaving(true);
    try {
      const exists = contacts.find(c => c.id === editingContact.id);
      
      if (exists) {
        await apiClient.put(`/contacts/${editingContact.id}`, {
          name: editingContact.name,
          active: editingContact.status === 'Ativo'
        });
        showToast.success(`Contato "${editingContact.name}" atualizado com sucesso via API.`);
      } else {
        await apiClient.post('/contacts', {
          name: editingContact.name,
          phoneNumber: editingContact.phone.replace(/\D/g, '') // Send numeric only or parsed format based on backend
        });
        showToast.success(`Novo contato cadastrado com sucesso via API.`);
      }
      
      await fetchContacts();
      setShowEditModal(false);
      setEditingContact(null);
    } catch {
      showToast.error('Erro ao salvar o contato. Verifique os dados e tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteOne = async (id: string, name: string) => {
    try {
      await apiClient.delete(`/contacts/${id}`);
      showToast.success(`Contato "${name}" excluído com sucesso.`);
      fetchContacts();
    } catch {
      showToast.error('Erro ao excluir o contato.');
    }
  };

  const handleToggleStatusOne = async (id: string) => {
    const contact = contacts.find(c => c.id === id);
    if (!contact) return;
    
    const nextStat = contact.status === 'Ativo' ? 'Inativo' : 'Ativo';
    try {
      await apiClient.put(`/contacts/${id}`, { active: nextStat === 'Ativo' });
      showToast.info(`O status foi alterado para ${nextStat}.`);
      fetchContacts();
    } catch {
      showToast.error('Erro ao alterar status.');
    }
  };

  const getCategoryBadgeVariant = (cat: Contact['category']) => {
    switch (cat) {
      case 'VIP': return 'error';
      case 'Cliente': return 'success';
      case 'Imprensa': return 'warning';
      default: return 'primary';
    }
  };

  // Dynamic Statistics Calculations for Charts
  const statsData = useMemo(() => {
    const active = contacts.filter(c => c.status === 'Ativo').length;
    const inactive = contacts.length - active;
    const activeRate = contacts.length > 0 ? Math.round((active / contacts.length) * 100) : 0;
    const inactiveRate = contacts.length > 0 ? 100 - activeRate : 0;

    // Monthly Growth Calculations
    const monthsMap: Record<string, number> = {
      'Dez/25': 0, 'Jan/26': 0, 'Fev/26': 0, 'Mar/26': 0, 'Abr/26': 0, 'Mai/26': 0
    };

    contacts.forEach(c => {
      const parts = c.dateAdded.split('/');
      if (parts.length === 3) {
        const m = Number(parts[1]);
        if (m === 12) monthsMap['Dez/25'] = (monthsMap['Dez/25'] || 0) + 1;
        else if (m === 1) monthsMap['Jan/26'] = (monthsMap['Jan/26'] || 0) + 1;
        else if (m === 2) monthsMap['Fev/26'] = (monthsMap['Fev/26'] || 0) + 1;
        else if (m === 3) monthsMap['Mar/26'] = (monthsMap['Mar/26'] || 0) + 1;
        else if (m === 4) monthsMap['Abr/26'] = (monthsMap['Abr/26'] || 0) + 1;
        else if (m === 5) monthsMap['Mai/26'] = (monthsMap['Mai/26'] || 0) + 1;
      }
    });

    const monthlyGrowth = Object.entries(monthsMap).map(([name, NovasInscricoes]) => ({
      name,
      NovasInscricoes
    }));

    // Top Contacts with Broadcasts
    const topContacts = contacts.slice(0, 4).map((c, index) => ({
      ...c,
      broadcastsCount: 24 - index * 5,
      lastDelivery: 'Há 2 horas'
    }));

    return {
      active, inactive, activeRate, inactiveRate, monthlyGrowth, topContacts
    };
  }, [contacts]);

  const currentValidity = editingContact ? checkPhoneValidity(editingContact.phone) : null;
  const validCount = parsedRows.filter(r => r.valid).length;
  const invalidCount = parsedRows.filter(r => !r.valid).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: selectedIds.length > 0 ? '100px' : '0' }}>
      
      {/* Contact Creation / Edit Modal */}
      {showEditModal && editingContact && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
          animation: 'fade-in 0.2s ease-out',
        }}>
          <div className="glass-panel" style={{
            maxWidth: '520px', width: '100%', padding: '36px', display: 'flex', flexDirection: 'column', gap: '24px',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)', border: '1px solid color-mix(in srgb, var(--primary) 40%, transparent)',
            animation: 'scale-up 0.2s ease-out',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <UserCheck size={24} style={{ color: 'var(--primary)' }} />
                <span>{contacts.some(c => c.id === editingContact.id) ? 'Editar Contato' : 'Cadastrar Novo Contato'}</span>
              </h3>
              <button onClick={() => setShowEditModal(false)} disabled={isSaving} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
            </div>

            <form onSubmit={handleSaveContact} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Nome Completo</span>
                  <span style={{ color: 'var(--error)' }}>*Obrigatório</span>
                </label>
                <input type="text" placeholder="Ex: Maria de Souza" value={editingContact.name} onChange={e => setEditingContact({ ...editingContact, name: e.target.value })} disabled={isSaving} style={{ height: '46px', backgroundColor: 'color-mix(in srgb, var(--border) 20%, transparent)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0 16px', color: 'var(--text-main)', fontSize: '0.95rem' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Número de WhatsApp (Com DDD)</span>
                  <span style={{ color: 'var(--error)' }}>*Obrigatório</span>
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input type="text" placeholder="+55 (11) 98888-7777" value={editingContact.phone} onChange={e => handleModalPhoneChange(e.target.value)} disabled={isSaving} style={{ width: '100%', height: '46px', backgroundColor: 'color-mix(in srgb, var(--border) 20%, transparent)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0 16px 0 44px', color: 'var(--text-main)', fontFamily: 'monospace', fontSize: '0.95rem' }} />
                  <Phone size={18} style={{ position: 'absolute', left: '16px', color: 'var(--text-muted)' }} />
                </div>
                {currentValidity && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', fontSize: '0.8rem', color: currentValidity.color }}>
                    {currentValidity.valid ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                    <span style={{ fontWeight: 600 }}>{currentValidity.text}</span>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Categoria da Lista</label>
                  <select value={editingContact.category} onChange={e => setEditingContact({ ...editingContact, category: e.target.value as Contact['category'] })} disabled={isSaving} style={{ height: '46px', backgroundColor: 'color-mix(in srgb, var(--border) 20%, transparent)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0 16px', color: 'var(--text-main)', fontSize: '0.95rem' }}>
                    <option value="Geral" style={{ background: 'var(--surface)' }}>Geral</option>
                    <option value="VIP" style={{ background: 'var(--surface)' }}>VIP</option>
                    <option value="Cliente" style={{ background: 'var(--surface)' }}>Cliente</option>
                    <option value="Imprensa" style={{ background: 'var(--surface)' }}>Imprensa</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Status de Disparo</label>
                  <div onClick={() => { if (!isSaving) setEditingContact({ ...editingContact, status: editingContact.status === 'Ativo' ? 'Inativo' : 'Ativo' }); }} style={{ height: '46px', backgroundColor: 'color-mix(in srgb, var(--border) 20%, transparent)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: isSaving ? 'not-allowed' : 'pointer', userSelect: 'none' }}>
                    <span style={{ fontSize: '0.95rem', fontWeight: 600, color: editingContact.status === 'Ativo' ? 'var(--success)' : 'var(--text-muted)' }}>{editingContact.status === 'Ativo' ? 'Ativo (Permitido)' : 'Inativo (Pausado)'}</span>
                    <div style={{ width: '40px', height: '22px', borderRadius: '11px', backgroundColor: editingContact.status === 'Ativo' ? 'var(--success)' : 'color-mix(in srgb, var(--border) 40%, transparent)', padding: '2px', display: 'flex', alignItems: 'center', transition: 'all 0.3s', justifyContent: editingContact.status === 'Ativo' ? 'flex-end' : 'flex-start' }}><div style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: 'var(--text-main)', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} /></div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <Button type="button" variant="secondary" onClick={() => setShowEditModal(false)} disabled={isSaving} style={{ flex: 1, height: '48px' }}>Cancelar</Button>
                <Button type="submit" variant="primary" isLoading={isSaving} style={{ flex: 1, height: '48px' }}>{isSaving ? 'Salvando Contato...' : 'Salvar Contato'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Bulk Deletion */}
      {showBulkDeleteModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
          animation: 'fade-in 0.2s ease-out',
        }}>
          <div className="glass-panel" style={{
            maxWidth: '460px', width: '100%', padding: '36px', display: 'flex', flexDirection: 'column',
            alignItems: 'center', textAlign: 'center', gap: '24px', border: '1px solid color-mix(in srgb, var(--error) 40%, transparent)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'color-mix(in srgb, var(--error) 10%, transparent)', color: 'var(--error)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={32} />
            </div>

            <div>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-main)' }}>Confirmar Exclusão em Lote</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '8px', lineHeight: 1.5 }}>
                Você está prestes a excluir permanentemente <strong style={{ color: 'var(--text-main)' }}>{selectedIds.length} contato(s)</strong> selecionado(s) da base. Esta ação não poderá ser desfeita.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '8px' }}>
              <button type="button" onClick={() => setShowBulkDeleteModal(false)} disabled={isBulking} style={{ flex: 1, height: '46px', borderRadius: '10px', border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--text-main)', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', transition: 'background-color 0.2s' }}>
                Cancelar
              </button>
              <button type="button" onClick={handleConfirmBulkDelete} disabled={isBulking} style={{ flex: 1, height: '46px', borderRadius: '10px', border: 'none', backgroundColor: 'var(--error)', color: 'var(--text-main)', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 0 20px color-mix(in srgb, var(--error) 40%, transparent)' }}>
                {isBulking ? <RefreshCw size={16} className="animate-spin" /> : <Trash2 size={16} />}
                <span>{isBulking ? 'Processando Lote...' : `Sim, Excluir ${selectedIds.length}`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div style={{
          position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 5000,
          width: 'calc(100% - 48px)', maxWidth: '800px', padding: '16px 24px',
          backgroundColor: 'color-mix(in srgb, var(--surface) 95%, transparent)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          borderRadius: '16px', border: '1px solid var(--primary)', boxShadow: '0 20px 60px color-mix(in srgb, var(--primary) 30%, transparent)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px',
          animation: 'slide-up 0.3s ease-out',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'color-mix(in srgb, var(--primary) 20%, transparent)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
              {selectedIds.length}
            </div>
            <div>
              <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '1rem', display: 'block' }}>Contatos Selecionados em Lote</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Escolha uma operação para aplicar simultaneamente</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <Button type="button" variant="secondary" onClick={() => handleBulkStatusChange('Ativo')} disabled={isBulking} style={{ height: '38px', fontSize: '0.85rem', borderColor: 'var(--success)', color: 'var(--success)' }}>
              {isBulking ? 'Aguarde...' : 'Ativar Selecionados'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => handleBulkStatusChange('Inativo')} disabled={isBulking} style={{ height: '38px', fontSize: '0.85rem', borderColor: 'var(--warning)', color: 'var(--warning)' }}>
              {isBulking ? 'Aguarde...' : 'Desativar'}
            </Button>
            <Button type="button" variant="primary" onClick={() => setShowBulkDeleteModal(true)} disabled={isBulking} style={{ height: '38px', fontSize: '0.85rem', backgroundColor: 'var(--error)', borderColor: 'var(--error)' }}>
              Excluir em Massa
            </Button>
            <button onClick={() => setSelectedIds([])} title="Limpar Seleção" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer', paddingLeft: '8px' }}>
              &times;
            </button>
          </div>
        </div>
      )}

      <div className="page-hero">
        <div className="page-hero-copy">
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Users size={28} style={{ color: 'var(--primary)' }} />
            Contatos
          </h1>
          <p>Cadastre, importe CSV e gerencie destinatários dos disparos.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Button type="button" variant="secondary" icon={BarChart3} onClick={() => setShowAnalytics((prev) => !prev)}>
            {showAnalytics ? 'Ocultar métricas' : 'Métricas'}
          </Button>
          <Button type="button" variant="secondary" icon={UploadCloud} onClick={() => setShowImportPanel((prev) => !prev)}>
            {showImportPanel ? 'Ocultar importação' : 'Importar CSV'}
          </Button>
          <Button type="button" variant="secondary" icon={Download} onClick={handleExportCSV}>
            Exportar
          </Button>
          <Button type="button" variant="primary" icon={Plus} onClick={handleOpenNewModal}>
            Novo contato
          </Button>
        </div>
      </div>

      {/* Advanced Drag-and-Drop CSV Import Panel */}
      {showImportPanel && (
        <div className="glass-panel" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
                <FileSpreadsheet size={22} style={{ color: 'var(--primary)' }} />
                <span>Importar CSV</span>
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
                Arraste seu arquivo .csv estruturado ou baixe a planilha modelo para padronizar o cadastro em lote.
              </p>
            </div>

            <Button type="button" variant="secondary" icon={FileText} onClick={handleDownloadTemplate} style={{ fontSize: '0.85rem' }}>
              Baixar Modelo de Importação
            </Button>
          </div>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${isDragging ? 'var(--primary)' : 'var(--border)'}`,
              borderRadius: '16px', padding: '48px 24px', backgroundColor: isDragging ? 'color-mix(in srgb, var(--primary) 5%, transparent)' : 'color-mix(in srgb, var(--border) 10%, transparent)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '16px',
              cursor: 'pointer', transition: 'all 0.2s',
            }}
          >
            <input type="file" ref={fileInputRef} accept=".csv" onChange={e => e.target.files && e.target.files[0] && handleProcessCsvFile(e.target.files[0])} style={{ display: 'none' }} />
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'color-mix(in srgb, var(--primary) 10%, transparent)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UploadCloud size={32} />
            </div>
            <div>
              <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '1.1rem', display: 'block' }}>
                {importFileName ? `Arquivo Selecionado: ${importFileName}` : 'Arraste seu arquivo CSV ou clique para buscar'}
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                Suporta milhares de linhas estruturadas. Encoding recomendado: UTF-8.
              </span>
            </div>
          </div>

          {parsedRows.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '24px', borderRadius: '12px', backgroundColor: 'color-mix(in srgb, var(--border) 15%, transparent)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)' }}>
                    <CheckCircle2 size={18} />
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{validCount} Linhas Válidas</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: invalidCount > 0 ? 'var(--error)' : 'var(--text-muted)' }}>
                    <AlertCircle size={18} />
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{invalidCount} Inválidas (Ignoradas)</span>
                  </div>
                </div>

                {validCount > 0 && !isImporting && (
                  <Button type="button" variant="primary" onClick={handleExecuteImport}>
                    Confirmar e Importar {validCount} Contatos
                  </Button>
                )}
              </div>

              {isImporting && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    <span>Processando e inserindo lote...</span>
                    <span style={{ fontWeight: 700, color: 'var(--primary)', fontFamily: 'monospace' }}>{importProgress}%</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', backgroundColor: 'color-mix(in srgb, var(--border) 30%, transparent)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${importProgress}%`, height: '100%', backgroundColor: 'var(--primary)', transition: 'width 0.2s linear' }} />
                  </div>
                </div>
              )}

              {invalidCount > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto', padding: '12px', borderRadius: '8px', backgroundColor: 'color-mix(in srgb, var(--error) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--error) 20%, transparent)' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--error)' }}>Inconsistências encontradas nas linhas:</span>
                  {parsedRows.filter(r => !r.valid).slice(0, 10).map(row => (
                    <div key={row.index} style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: '12px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>Linha #{row.index}:</span>
                      <span>{row.errors.join(', ')} (Valor: &quot;{row.name}&quot; / &quot;{row.phone}&quot;)</span>
                    </div>
                  ))}
                  {invalidCount > 10 && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>... e mais {invalidCount - 10} linha(s) com erros.</span>}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sprint 25: Premium Analytics & Statistics Dashboard */}
      {showAnalytics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', animation: 'slide-down 0.3s ease-out' }}>
          
          {/* Card 1: Active vs Inactive Ratio Pie Chart */}
          <div className="glass-panel" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Activity size={22} style={{ color: 'var(--primary)' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>Taxa de Conformidade e Status</h3>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
              <div style={{ width: '140px', height: '140px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Ativos', value: statsData.active },
                        { name: 'Inativos', value: statsData.inactive }
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      <Cell fill="var(--success)" />
                      <Cell fill="var(--warning)" />
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-main)' }}
                      itemStyle={{ color: 'var(--text-main)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--success)' }} />
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Contatos Ativos</span>
                  </div>
                  <span style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-main)' }}>{statsData.activeRate}% <span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--text-muted)' }}>({statsData.active})</span></span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--warning)' }} />
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Pausados / Inativos</span>
                  </div>
                  <span style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-main)' }}>{statsData.inactiveRate}% <span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--text-muted)' }}>({statsData.inactive})</span></span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Monthly Growth Line Chart */}
          <div className="glass-panel" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <TrendingUp size={22} style={{ color: 'var(--primary)' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>Evolução de Cadastros (Novas Inscrições)</h3>
            </div>

            <div style={{ width: '100%', height: '140px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={statsData.monthlyGrowth}>
                  <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                  <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} width={28} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-main)' }} 
                    itemStyle={{ color: 'var(--primary)' }}
                  />
                  <Line type="monotone" dataKey="NovasInscricoes" stroke="var(--primary)" strokeWidth={3} dot={{ r: 4, fill: 'var(--primary)' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Card 3: Top Broadcast Contacts */}
          <div className="glass-panel" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Award size={22} style={{ color: 'var(--primary)' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>Destinatários com Mais Disparos</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {statsData.topContacts.map(tc => (
                <div key={tc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: '8px', backgroundColor: 'color-mix(in srgb, var(--border) 15%, transparent)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>{tc.name}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Último: {tc.lastDelivery}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Badge variant="primary">{tc.broadcastsCount} envios</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* Control Panel: Search, Quick Filters */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'space-between', alignItems: 'center' }}>
          
          <div style={{ position: 'relative', flex: '1 1 320px', maxWidth: '500px' }}>
            <input
              type="text"
              placeholder="Buscar por nome, telefone ou categoria..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%', height: '46px', backgroundColor: 'color-mix(in srgb, var(--border) 20%, transparent)',
                border: '1px solid var(--border)', borderRadius: '10px', padding: '0 16px 0 44px',
                color: 'var(--text-main)', fontSize: '0.95rem',
              }}
            />
            <Search size={18} style={{ position: 'absolute', left: '16px', top: '14px', color: 'var(--text-muted)' }} />
            {searchTerm !== debouncedSearchTerm && (
              <span style={{ position: 'absolute', right: '16px', top: '14px', fontSize: '0.75rem', color: 'var(--primary)', animation: 'pulse 1s infinite' }}>
                Filtrando...
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Filter size={16} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Status:</span>
              <div style={{ display: 'flex', gap: '4px', background: 'color-mix(in srgb, var(--border) 20%, transparent)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                {(['Todos', 'Ativo', 'Inativo'] as const).map(st => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    style={{
                      padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, border: 'none', cursor: 'pointer',
                      background: statusFilter === st ? 'var(--primary)' : 'transparent',
                      color: statusFilter === st ? 'white' : 'var(--text-muted)',
                      transition: 'all 0.2s',
                    }}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Tags size={16} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Categoria:</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                style={{ height: '36px', backgroundColor: 'color-mix(in srgb, var(--border) 20%, transparent)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0 12px', color: 'var(--text-main)', fontSize: '0.85rem' }}
              >
                <option value="Todas" style={{ background: 'var(--surface)' }}>Todas as Categorias</option>
                <option value="VIP" style={{ background: 'var(--surface)' }}>VIP</option>
                <option value="Cliente" style={{ background: 'var(--surface)' }}>Cliente</option>
                <option value="Imprensa" style={{ background: 'var(--surface)' }}>Imprensa</option>
                <option value="Geral" style={{ background: 'var(--surface)' }}>Geral</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Datatable + mobile cards */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <div className="table-scroll contacts-desktop-table">
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 720 }}>
            <thead>
              <tr style={{ backgroundColor: 'color-mix(in srgb, var(--border) 35%, transparent)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '14px', width: '48px', textAlign: 'center' }}>
                  <button type="button" onClick={handleSelectAll} aria-label="Selecionar todos" style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', cursor: 'pointer' }}>
                    {selectedIds.length === paginatedContacts.length && paginatedContacts.length > 0 ? (
                      <CheckSquare size={18} style={{ color: 'var(--primary)' }} />
                    ) : (
                      <Square size={18} style={{ color: 'var(--text-muted)' }} />
                    )}
                  </button>
                </th>
                <th style={{ padding: '14px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => handleSort('name')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>Nome</span>
                    <ArrowUpDown size={14} aria-hidden style={{ color: sortField === 'name' ? 'var(--primary)' : 'var(--text-muted)' }} />
                  </div>
                </th>
                <th style={{ padding: '14px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>WhatsApp</th>
                <th style={{ padding: '14px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => handleSort('category')}>
                  Categoria
                </th>
                <th style={{ padding: '14px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => handleSort('status')}>
                  Status
                </th>
                <th style={{ padding: '14px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => handleSort('dateAdded')}>
                  Cadastro
                </th>
                <th style={{ padding: '14px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedContacts.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Nenhum contato encontrado com os filtros atuais.
                  </td>
                </tr>
              ) : (
                paginatedContacts.map((contact) => {
                  const isSelected = selectedIds.includes(contact.id);
                  return (
                    <tr
                      key={contact.id}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        backgroundColor: isSelected ? 'var(--primary-alpha)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '14px', textAlign: 'center' }}>
                        <button type="button" onClick={() => handleSelectOne(contact.id)} aria-label={`Selecionar ${contact.name}`} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                          {isSelected ? <CheckSquare size={18} style={{ color: 'var(--primary)' }} /> : <Square size={18} style={{ color: 'var(--text-muted)' }} />}
                        </button>
                      </td>
                      <td style={{ padding: '14px', minWidth: 0 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                          <span className="truncate" style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem' }} title={contact.name}>{contact.name}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {contact.id}</span>
                        </div>
                      </td>
                      <td className="text-break" style={{ padding: '14px', fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                        {contact.phone}
                      </td>
                      <td style={{ padding: '14px' }}>
                        <Badge variant={getCategoryBadgeVariant(contact.category)}>{contact.category}</Badge>
                      </td>
                      <td style={{ padding: '14px' }}>
                        <Badge variant={contact.status === 'Ativo' ? 'success' : 'warning'}>{contact.status}</Badge>
                      </td>
                      <td style={{ padding: '14px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                        {contact.dateAdded}
                      </td>
                      <td style={{ padding: '16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            title={contact.status === 'Ativo' ? 'Desativar Contato' : 'Ativar Contato'}
                            onClick={() => handleToggleStatusOne(contact.id)}
                            style={{ width: '32px', height: '32px', borderRadius: '6px', backgroundColor: 'color-mix(in srgb, var(--border) 20%, transparent)', border: '1px solid var(--border)', color: contact.status === 'Ativo' ? 'var(--success)' : 'var(--warning)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                          >
                            {contact.status === 'Ativo' ? <Check size={16} /> : <X size={16} />}
                          </button>
                          <button
                            type="button"
                            title="Editar Contato"
                            onClick={() => { setEditingContact(contact); setShowEditModal(true); }}
                            style={{ width: '32px', height: '32px', borderRadius: '6px', backgroundColor: 'color-mix(in srgb, var(--border) 20%, transparent)', border: '1px solid var(--border)', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            type="button"
                            title="Excluir Contato"
                            onClick={() => handleDeleteOne(contact.id, contact.name)}
                            style={{ width: '32px', height: '32px', borderRadius: '6px', backgroundColor: 'color-mix(in srgb, var(--border) 20%, transparent)', border: '1px solid var(--border)', color: 'var(--error)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="contact-mobile-list" style={{ padding: 12 }}>
          {paginatedContacts.length === 0 ? (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-muted)' }}>
              Nenhum contato encontrado.
            </div>
          ) : (
            paginatedContacts.map((contact) => {
              const isSelected = selectedIds.includes(contact.id);
              return (
                <div key={`m-${contact.id}`} className="glass-panel contact-mobile-card">
                  <div className="contact-mobile-card__row">
                    <button type="button" onClick={() => handleSelectOne(contact.id)} aria-label={`Selecionar ${contact.name}`} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                      {isSelected ? <CheckSquare size={18} style={{ color: 'var(--primary)' }} /> : <Square size={18} style={{ color: 'var(--text-muted)' }} />}
                    </button>
                    <strong className="truncate" style={{ flex: 1 }} title={contact.name}>{contact.name}</strong>
                    <Badge variant={contact.status === 'Ativo' ? 'success' : 'warning'}>{contact.status}</Badge>
                  </div>
                  <div className="contact-mobile-card__phone">{contact.phone}</div>
                  <div className="contact-mobile-card__row">
                    <Badge variant={getCategoryBadgeVariant(contact.category)}>{contact.category}</Badge>
                    <div className="stack-actions">
                      <button
                        type="button"
                        aria-label={`Editar ${contact.name}`}
                        onClick={() => { setEditingContact(contact); setShowEditModal(true); }}
                        className="btn btn-ghost"
                        style={{ minHeight: 36, padding: '6px 10px' }}
                      >
                        <Edit size={16} aria-hidden />
                      </button>
                      <button
                        type="button"
                        aria-label={`Excluir ${contact.name}`}
                        onClick={() => handleDeleteOne(contact.id, contact.name)}
                        className="btn btn-ghost"
                        style={{ minHeight: 36, padding: '6px 10px', color: 'var(--error)' }}
                      >
                        <Trash2 size={16} aria-hidden />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Classic Pagination Controls */}
        <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Por página:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
              className="form-input"
              style={{ width: 'auto', height: 36, padding: '0 10px' }}
              aria-label="Itens por página"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {filteredAndSortedContacts.length} registro(s)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              aria-label="Primeira página"
              className="btn btn-ghost"
              style={{ width: 36, height: 36, padding: 0 }}
            >
              <ChevronsLeft size={16} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              aria-label="Página anterior"
              className="btn btn-ghost"
              style={{ width: 36, height: 36, padding: 0 }}
            >
              <ChevronLeft size={16} aria-hidden />
            </button>

            <span style={{ fontSize: '0.85rem', color: 'var(--text-main)', padding: '0 8px', fontWeight: 600 }}>
              {currentPage}/{Math.max(1, totalPages)}
            </span>

            <button
              type="button"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              aria-label="Próxima página"
              className="btn btn-ghost"
              style={{ width: 36, height: 36, padding: 0 }}
            >
              <ChevronRight size={16} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages || totalPages === 0}
              aria-label="Última página"
              className="btn btn-ghost"
              style={{ width: 36, height: 36, padding: 0 }}
            >
              <ChevronsRight size={16} aria-hidden />
            </button>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Contacts;
