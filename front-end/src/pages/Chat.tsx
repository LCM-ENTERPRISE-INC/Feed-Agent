import React, { useState, useEffect, useRef } from 'react';
import { Send, User, MessageSquare } from 'lucide-react';
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
  text: string;
  fromMe: boolean;
  timestamp: number;
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
            setSelectedInstanceId(connectedInstances[0].id);
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
        const { fromNumber, text, timestamp, messageId } = data;
        
        setChatHistory(prev => {
          const contactHistory = prev[fromNumber] || [];
          if (contactHistory.some(m => m.id === messageId)) return prev;
          
          return {
            ...prev,
            [fromNumber]: [...contactHistory, { id: messageId, text, fromMe: false, timestamp }]
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

  // Scroll to bottom when history changes
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, selectedContact]);

  const handleSendMessage = async () => {
    if (!selectedContact || !inputText.trim() || !selectedInstanceId) return;

    const tempId = `temp-${Date.now()}`;
    const message = inputText.trim();
    
    // Optimistic UI update
    setChatHistory(prev => ({
      ...prev,
      [selectedContact]: [
        ...(prev[selectedContact] || []),
        { id: tempId, text: message, fromMe: true, timestamp: Date.now() }
      ]
    }));
    setInputText('');

    try {
      await apiClient.post(`/whatsapp/instances/${selectedInstanceId}/test-message`, {
        phoneNumber: selectedContact,
        message
      });
    } catch (err) {
      showToast.error('Erro ao enviar mensagem');
    }
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
      setSelectedContact(cleanNumber);
    }
  };

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
          <h3 style={{ fontWeight: 600 }}>Call List</h3>
          <Button variant="secondary" onClick={handleNewChat} style={{ padding: '6px 12px', fontSize: '0.85rem' }}>+ Novo</Button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {callList.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Nenhum contato encontrado
            </div>
          ) : (
            callList.map(contact => (
              <div 
                key={contact.phone} 
                onClick={() => setSelectedContact(contact.phone)}
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
            {instances.length > 0 ? (
              <select 
                value={selectedInstanceId || ''} 
                onChange={e => setSelectedInstanceId(Number(e.target.value))}
                className="form-input"
                style={{ padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem' }}
                title="Selecione a conta de envio"
              >
                {instances.map(inst => (
                  <option key={inst.id} value={inst.id}>{inst.name}</option>
                ))}
              </select>
            ) : (
              <span style={{ color: 'var(--error)', fontSize: '0.85rem' }}>Nenhuma conta WhatsApp</span>
            )}
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
                    <div style={{ wordBreak: 'break-word', lineHeight: '1.4' }}>{msg.text}</div>
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
            <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border)', backgroundColor: 'var(--surface)', display: 'flex', gap: 16, alignItems: 'flex-end' }}>
              <textarea 
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Text Input..."
                className="form-input"
                style={{ flex: 1, resize: 'none', height: 52, padding: '14px 20px', borderRadius: 26, overflow: 'hidden' }}
              />
              <Button 
                onClick={handleSendMessage} 
                disabled={!inputText.trim()}
                style={{ width: 52, height: 52, borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                title="Send"
              >
                <Send size={22} />
              </Button>
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
    </>
  );
};
