import React, { useState, useEffect, useRef } from 'react';
import { Send, User, MessageSquare, Smartphone, ChevronDown, Search, Paperclip, X, FileText, Play } from 'lucide-react';
import { Button } from '@/components/Button';
import { showToast } from '@/utils/toastHelper';
import apiClient from '@/services/apiClient';
import useAuthStore from '@/store/authStore';

// Types
interface WhatsAppInstance {
  id: number;
  name: string;
  liveStatus: { state: string };
}

interface ChatMessage {
  id: string;
  text?: string;
  fromMe: boolean;
  timestamp: number;
  mediaUrl?: string;
  mediaType?: string;
}

interface Contact {
  phone: string;
  name: string;
}

export const Chat: React.FC = () => {
  const { token } = useAuthStore();
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<number | null>(null);
  
  const [callList, setCallList] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<Record<string, ChatMessage[]>>({});
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mediaModal, setMediaModal] = useState<{ url: string, type: string } | null>(null);
  
  const [isInstanceModalOpen, setIsInstanceModalOpen] = useState(false);
  const [contactInstanceMap, setContactInstanceMap] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem('contactInstanceMap') || '{}');
    } catch {
      return {};
    }
  });

  const updateContactInstance = (contactPhone: string, instanceId: number) => {
    const newMap = { ...contactInstanceMap, [contactPhone]: instanceId };
    setContactInstanceMap(newMap);
    localStorage.setItem('contactInstanceMap', JSON.stringify(newMap));
  };

  const handleSelectContact = async (contactPhone: string) => {
    setSelectedContact(contactPhone);
    setChatHistory(prev => ({ ...prev, [contactPhone]: prev[contactPhone] || [] }));
    
    // Check if we already have a preferred instance
    const savedInstanceId = contactInstanceMap[contactPhone];
    if (savedInstanceId && instances.some(i => i.id === savedInstanceId)) {
      setSelectedInstanceId(savedInstanceId);
      return;
    }

    // Otherwise, discover:
    setSelectedInstanceId(null);
    if (instances.length === 0) return;

    // Fetch history from all instances in parallel
    try {
      const results = await Promise.all(
        instances.map(async inst => {
          const res = await apiClient.get(`/whatsapp/instances/${inst.id}/messages?contact=${contactPhone}`);
          return { inst, history: res.data?.data || [] };
        })
      );
      
      const instanceWithHistory = results.find(r => r.history.length > 0);
      if (instanceWithHistory) {
        updateContactInstance(contactPhone, instanceWithHistory.inst.id);
        setSelectedInstanceId(instanceWithHistory.inst.id);
      } else {
        setSelectedInstanceId(null);
      }
    } catch (err) {
      console.error('Erro ao descobrir instância do contato', err);
    }
  };
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Fetch instances and contacts
  useEffect(() => {
    const initData = async () => {
      try {
        const [instRes, contRes] = await Promise.all([
          apiClient.get('/whatsapp/instances'),
          apiClient.get('/contacts?page=1&limit=1000')
        ]);

        if (instRes.data?.success && instRes.data.data.length > 0) {
          const connectedInstances = instRes.data.data.filter((i: any) => 
            i.liveStatus?.state?.toLowerCase() === 'open'
          );
          setInstances(connectedInstances);
          if (connectedInstances.length > 0) {
            // We don't automatically select the first instance anymore. It is selected per contact.
          }
        }

        if (contRes.data?.success) {
          const mappedContacts = contRes.data.data.data.map((c: any) => ({
            phone: c.phoneNumber,
            name: c.name
          }));
          setCallList(mappedContacts);
        }
      } catch (err) {
        showToast.error('Erro ao inicializar dados do Bate-Papo');
      }
    };
    initData();
  }, []);

  // SSE connection
  useEffect(() => {
    if (!selectedInstanceId || !token) return;

    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
    const sseUrl = `${baseUrl}/whatsapp/instances/${selectedInstanceId}/messages/stream?token=${token}`;
    const eventSource = new EventSource(sseUrl);

    eventSource.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        const { fromNumber, text, timestamp, messageId, mediaUrl, mediaType } = data;
        
        setChatHistory(prev => {
          const contactHistory = prev[fromNumber] || [];
          if (contactHistory.some(m => m.id === messageId)) return prev;
          
          return {
            ...prev,
            [fromNumber]: [...contactHistory, { id: messageId, text, fromMe: false, timestamp, mediaUrl, mediaType }]
          };
        });

        setCallList(prev => {
          if (!prev.some(c => c.phone === fromNumber)) {
            return [{ phone: fromNumber, name: `+${fromNumber}` }, ...prev];
          }
          return prev;
        });
      } catch (e) {
        console.error('Error parsing SSE message', e);
      }
    });

    eventSource.addEventListener('error', (err) => {
      console.error('SSE Error:', err);
    });

    return () => {
      eventSource.close();
    };
  }, [selectedInstanceId, token]);

  // Fetch chat history from DB
  useEffect(() => {
    if (!selectedInstanceId || !selectedContact) return;
    
    const fetchHistory = async () => {
      try {
        const res = await apiClient.get(`/whatsapp/instances/${selectedInstanceId}/messages?contact=${selectedContact}`);
        if (res.data?.success) {
          const messages = res.data.data.map((msg: any) => ({
            id: msg.messageId,
            text: msg.text,
            fromMe: msg.fromMe,
            timestamp: msg.timestamp,
            mediaUrl: msg.mediaUrl,
            mediaType: msg.mediaType
          }));
          
          setChatHistory(prev => ({
            ...prev,
            [selectedContact]: messages
          }));
        }
      } catch (err) {
        console.error('Erro ao buscar histórico do Mongo', err);
      }
    };
    
    fetchHistory();
  }, [selectedInstanceId, selectedContact]);

  // Scroll to bottom when history changes
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, selectedContact]);

  const handleSendMessage = async () => {
    if (!selectedContact || (!inputText.trim() && !selectedFile) || !selectedInstanceId) return;

    const tempId = `temp-${Date.now()}`;
    const message = inputText.trim();
    
    // Optimistic UI update
    setChatHistory(prev => ({
      ...prev,
      [selectedContact]: [
        ...(prev[selectedContact] || []),
        { id: tempId, text: message, fromMe: true, timestamp: Date.now(), mediaUrl: filePreview || undefined, mediaType: selectedFile?.type }
      ]
    }));
    setInputText('');
    
    try {
      if (selectedFile) {
        const formData = new FormData();
        formData.append('phoneNumber', selectedContact);
        formData.append('caption', message);
        formData.append('file', selectedFile);

        setSelectedFile(null);
        setFilePreview(null);

        await apiClient.post(`/whatsapp/instances/${selectedInstanceId}/send-media`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        await apiClient.post(`/whatsapp/instances/${selectedInstanceId}/send-message`, {
          phoneNumber: selectedContact,
          message
        });
      }
    } catch (err) {
      showToast.error('Erro ao enviar mensagem');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => setFilePreview(reader.result as string);
        reader.readAsDataURL(file);
      } else {
        setFilePreview(null);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleNewChat = () => {
    const number = prompt('Digite o número do WhatsApp com DDI e DDD (ex: 5511999999999):');
    if (number) {
      const cleanNumber = number.replace(/\D/g, '');
      setCallList(prev => {
        if (!prev.some(c => c.phone === cleanNumber)) {
          return [{ phone: cleanNumber, name: `+${cleanNumber}` }, ...prev];
        }
        return prev;
      });
      handleSelectContact(cleanNumber);
    }
  };

  const filteredCallList = callList.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.phone.includes(searchQuery)
  );

  return (
    <>
      <style>{`
        .page-content-wrapper-box {
          max-width: none !important;
          width: 100% !important;
          margin: 0 !important;
        }
      `}</style>
      <div style={{ 
        margin: 'calc(var(--page-pad) * -1)', 
        height: 'calc(100vh - 72px)', 
        display: 'flex',
        backgroundColor: 'var(--surface)',
        overflow: 'hidden'
      }}>
      {/* Call List (Sidebar) */}
      <div style={{ 
        width: 320, 
        borderRight: '1px solid var(--border)', 
        display: 'flex', 
        flexDirection: 'column',
        backgroundColor: 'var(--app-bg)'
      }}>
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, marginRight: 12 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Buscar contato..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="form-input"
              style={{ padding: '8px 12px 8px 36px', width: '100%', borderRadius: 8, fontSize: '0.9rem', border: '1px solid var(--border)', backgroundColor: 'var(--app-bg)' }}
            />
          </div>
          <Button variant="secondary" onClick={handleNewChat} style={{ padding: '6px 12px', fontSize: '0.85rem' }}>+ Novo</Button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {filteredCallList.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Nenhum contato encontrado
            </div>
          ) : (
            filteredCallList.map(contact => (
              <div 
                key={contact.phone} 
                onClick={() => handleSelectContact(contact.phone)}
                style={{ 
                  padding: '16px 20px', 
                  borderBottom: '1px solid var(--border)', 
                  cursor: 'pointer',
                  backgroundColor: selectedContact === contact.phone ? 'var(--primary-alpha)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  transition: 'background-color 0.2s',
                  flexShrink: 0
                }}
              >
                <div style={{ minWidth: 40, height: 40, borderRadius: '50%', backgroundColor: 'var(--surface-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <User size={20} color="var(--text-muted)" />
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden' }}>{contact.name}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {chatHistory[contact.phone]?.length > 0 
                      ? chatHistory[contact.phone][chatHistory[contact.phone].length - 1].text 
                      : (contact.name !== `+${contact.phone}` ? `+${contact.phone}` : 'Iniciar conversa')}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat History & Input */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'color-mix(in srgb, var(--surface) 50%, var(--app-bg))' }}>
        {/* Chat Top Bar / Instance Selector */}
        <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--surface)', minHeight: 64 }}>
          {selectedContact ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ minWidth: 40, height: 40, borderRadius: '50%', backgroundColor: 'var(--primary-alpha)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={20} color="var(--primary)" />
              </div>
              <div>
                <h3 style={{ fontWeight: 600, fontSize: '1.1rem' }}>
                  {callList.find(c => c.phone === selectedContact)?.name || `+${selectedContact}`}
                </h3>
              </div>
            </div>
          ) : (
            <div style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Chat History</div>
          )}

          <div>
            {selectedInstanceId ? (
              <Button variant="secondary" onClick={() => setIsInstanceModalOpen(true)} style={{ padding: '8px 16px', borderRadius: 8, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Smartphone size={18} />
                {instances.find(i => i.id === selectedInstanceId)?.name || 'Dispositivo'}
                <ChevronDown size={16} style={{ marginLeft: 4 }} />
              </Button>
            ) : selectedContact ? (
              <Button variant="secondary" onClick={() => setIsInstanceModalOpen(true)} style={{ padding: '8px 16px', borderRadius: 8, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 8, border: '1px dashed var(--primary)', color: 'var(--primary)' }}>
                <Smartphone size={18} />
                Selecionar Canal
                <ChevronDown size={16} style={{ marginLeft: 4 }} />
              </Button>
            ) : null}
          </div>
        </div>

        {selectedContact ? (
          <>
            {/* Chat Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {chatHistory[selectedContact]?.length ? (
                chatHistory[selectedContact].map(msg => (
                  <div 
                    key={msg.id} 
                    style={{ 
                      alignSelf: msg.fromMe ? 'flex-end' : 'flex-start',
                      backgroundColor: msg.fromMe ? 'var(--primary)' : 'var(--surface)',
                      color: msg.fromMe ? '#fff' : 'inherit',
                      padding: '12px 18px',
                      borderRadius: 18,
                      borderBottomRightRadius: msg.fromMe ? 4 : 18,
                      borderBottomLeftRadius: !msg.fromMe ? 4 : 18,
                      maxWidth: '75%',
                      boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                      position: 'relative'
                    }}
                  >
                    {msg.mediaUrl && (
                      <div style={{ marginBottom: msg.text ? 8 : 0 }}>
                        {msg.mediaType?.startsWith('image/') && (
                          <img 
                            src={msg.mediaUrl.startsWith('data:') ? msg.mediaUrl : (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace('/api', '') + msg.mediaUrl} 
                            alt="attachment" 
                            style={{ maxWidth: '100%', borderRadius: 8, cursor: 'pointer', maxHeight: 200, objectFit: 'cover' }} 
                            onClick={() => setMediaModal({ url: msg.mediaUrl!, type: 'image' })}
                          />
                        )}
                        {msg.mediaType?.startsWith('video/') && (
                          <div 
                            style={{ width: 200, height: 120, backgroundColor: '#000', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                            onClick={() => setMediaModal({ url: msg.mediaUrl!, type: 'video' })}
                          >
                            <Play size={32} color="#fff" />
                          </div>
                        )}
                        {msg.mediaType?.startsWith('audio/') && (
                          <audio controls style={{ maxWidth: '100%', height: 40 }} src={(import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace('/api', '') + msg.mediaUrl} />
                        )}
                        {msg.mediaType?.startsWith('application/pdf') && (
                          <div 
                            style={{ padding: 12, backgroundColor: msg.fromMe ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.05)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                            onClick={() => setMediaModal({ url: msg.mediaUrl!, type: 'pdf' })}
                          >
                            <FileText size={24} />
                            <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Documento PDF</span>
                          </div>
                        )}
                        {msg.mediaUrl && !msg.mediaType?.startsWith('image/') && !msg.mediaType?.startsWith('video/') && !msg.mediaType?.startsWith('audio/') && !msg.mediaType?.startsWith('application/pdf') && (
                          <a href={(import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace('/api', '') + msg.mediaUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'inherit', textDecoration: 'none', padding: 12, backgroundColor: msg.fromMe ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.05)', borderRadius: 8 }}>
                            <FileText size={24} />
                            <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Download Arquivo</span>
                          </a>
                        )}
                      </div>
                    )}
                    {msg.text && <div style={{ wordBreak: 'break-word', lineHeight: '1.4' }}>{msg.text}</div>}
                    <div style={{ fontSize: '0.7rem', opacity: 0.7, marginTop: 6, textAlign: 'right' }}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 'auto', marginBottom: 'auto' }}>
                  <p>Inicie a conversa com este contato.</p>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Text Input Area */}
            <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border)', backgroundColor: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {selectedFile && (
                <div style={{ padding: 12, backgroundColor: 'var(--app-bg)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
                  {filePreview ? (
                    <img src={filePreview} alt="preview" style={{ width: 40, height: 40, borderRadius: 4, objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: 40, height: 40, borderRadius: 4, backgroundColor: 'var(--primary-alpha)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FileText size={20} color="var(--primary)" />
                    </div>
                  )}
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.9rem' }}>{selectedFile.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</div>
                  </div>
                  <button onClick={() => { setSelectedFile(null); setFilePreview(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                    <X size={18} color="var(--text-muted)" />
                  </button>
                </div>
              )}
              
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileSelect} 
                  style={{ display: 'none' }}
                />
                <Button 
                  variant="secondary"
                  onClick={() => fileInputRef.current?.click()} 
                  style={{ width: 52, height: 52, borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, backgroundColor: 'var(--app-bg)', border: '1px solid var(--border)' }}
                  title="Anexar arquivo"
                >
                  <Paperclip size={22} color="var(--text-muted)" />
                </Button>

                <textarea 
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder={selectedFile ? "Adicione uma legenda..." : "Digite uma mensagem..."}
                  className="form-input"
                  style={{ flex: 1, resize: 'none', height: 52, padding: '14px 20px', borderRadius: 26, overflow: 'hidden' }}
                />
                
                <Button 
                  onClick={handleSendMessage} 
                  disabled={!inputText.trim() && !selectedFile}
                  style={{ width: 52, height: 52, borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                  title="Enviar"
                >
                  <Send size={22} />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            <MessageSquare size={64} style={{ marginBottom: 20, opacity: 0.15 }} />
            <h3 style={{ fontSize: '1.2rem', marginBottom: 8 }}>Seu Bate-papo</h3>
            <p>Selecione um contato na Call List ao lado ou inicie uma nova conversa.</p>
          </div>
        )}
      </div>
    </div>
    
      {/* Grid Modal para Seleção de Dispositivo */}
      {isInstanceModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(2px)'
        }} onClick={() => setIsInstanceModalOpen(false)}>
          <div style={{
            backgroundColor: 'var(--surface)', padding: 32, borderRadius: 16,
            width: 500, maxWidth: '90%', boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
          }} onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: 24, fontSize: '1.4rem' }}>Selecionar Canal WhatsApp</h2>
            {instances.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>Nenhum canal conectado disponível.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
                {instances.map(inst => (
                  <div 
                    key={inst.id} 
                    onClick={() => {
                      if (selectedContact) {
                        updateContactInstance(selectedContact, inst.id);
                      }
                      setSelectedInstanceId(inst.id);
                      setIsInstanceModalOpen(false);
                    }}
                    style={{
                      padding: 24, borderRadius: 12, border: '1px solid var(--border)',
                      cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s',
                      backgroundColor: selectedInstanceId === inst.id ? 'var(--primary-alpha)' : 'var(--surface-hover)',
                      borderColor: selectedInstanceId === inst.id ? 'var(--primary)' : 'var(--border)'
                    }}
                  >
                    <Smartphone size={32} color={selectedInstanceId === inst.id ? 'var(--primary)' : 'var(--text-muted)'} style={{ margin: '0 auto 12px' }} />
                    <div style={{ fontWeight: 600 }}>{inst.name}</div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 32, textAlign: 'right' }}>
              <Button variant="secondary" onClick={() => setIsInstanceModalOpen(false)}>Cancelar</Button>
            </div>
          </div>
        </div>
      )}

      {/* Media Viewer Modal */}
      {mediaModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 10000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)'
        }} onClick={() => setMediaModal(null)}>
          <button 
            onClick={() => setMediaModal(null)} 
            style={{ position: 'absolute', top: 24, right: 24, background: 'none', border: 'none', cursor: 'pointer', color: '#fff' }}
          >
            <X size={32} />
          </button>
          
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: '90%', maxHeight: '90%', display: 'flex', justifyContent: 'center' }}>
            {mediaModal.type === 'image' && (
              <img src={mediaModal.url.startsWith('data:') ? mediaModal.url : (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace('/api', '') + mediaModal.url} alt="Fullscreen" style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain' }} />
            )}
            {mediaModal.type === 'video' && (
              <video src={(import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace('/api', '') + mediaModal.url} controls autoPlay style={{ maxWidth: '100%', maxHeight: '90vh' }} />
            )}
            {mediaModal.type === 'pdf' && (
              <iframe src={(import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace('/api', '') + mediaModal.url} style={{ width: '80vw', height: '90vh', border: 'none', backgroundColor: '#fff' }} title="PDF Viewer" />
            )}
          </div>
        </div>
      )}
    </>
  );
};
