import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, User, MessageSquare, Smartphone, ChevronDown, Search, Paperclip, X, FileText, Play, RefreshCw } from 'lucide-react';
import { Button } from '@/components/Button';
import { showToast } from '@/utils/toastHelper';
import apiClient from '@/services/apiClient';
import useAuthStore from '@/store/authStore';

type MessageStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

interface WhatsAppInstance {
  id: number;
  name: string;
  liveStatus: { state: string };
}

interface ChatMessage {
  id: string;
  messageId: string;
  clientMessageId?: string;
  text?: string;
  fromMe: boolean;
  timestamp: number;
  status: MessageStatus;
  mediaUrl?: string;
  mediaType?: string;
}

interface Conversation {
  contactPhone: string;
  contactName: string | null;
  instanceId: number;
  lastMessageText: string | null;
  lastMessageAt: number;
  lastFromMe: boolean;
  lastStatus: MessageStatus | null;
  unreadCount: number;
}

const apiBase = () => {
  const raw = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
  return String(raw).replace(/\/+$/, '');
};

const mediaBase = () => apiBase().replace(/\/api$/, '');

const isChannelOpen = (state?: string) => String(state || '').toLowerCase() === 'open';

const statusLabel = (status?: MessageStatus) => {
  switch (status) {
    case 'PENDING':
      return '…';
    case 'SENT':
      return '✓';
    case 'DELIVERED':
      return '✓✓';
    case 'READ':
      return '✓✓';
    case 'FAILED':
      return '!';
    default:
      return '';
  }
};

export const Chat: React.FC = () => {
  const { token } = useAuthStore();
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<number | null>(null);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationsCursor, setConversationsCursor] = useState<string | null>(null);
  const [conversationsHasMore, setConversationsHasMore] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(true);

  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesCursor, setMessagesCursor] = useState<string | null>(null);
  const [messagesHasMore, setMessagesHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sending, setSending] = useState(false);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mediaModal, setMediaModal] = useState<{ url: string; type: string } | null>(null);

  const [isInstanceModalOpen, setIsInstanceModalOpen] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const seenMessageIds = useRef<Set<string>>(new Set());

  const selectedInstance = instances.find((i) => i.id === selectedInstanceId) || null;
  const channelConnected = isChannelOpen(selectedInstance?.liveStatus?.state);

  const upsertMessage = useCallback((incoming: ChatMessage) => {
    const key = incoming.messageId || incoming.id;
    setMessages((prev) => {
      const byClient =
        incoming.clientMessageId
          ? prev.findIndex((m) => m.clientMessageId === incoming.clientMessageId)
          : -1;
      const byId = prev.findIndex((m) => m.messageId === key || m.id === incoming.id);
      const idx = byClient >= 0 ? byClient : byId;
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...incoming };
        return next;
      }
      if (seenMessageIds.current.has(key)) return prev;
      seenMessageIds.current.add(key);
      return [...prev, incoming];
    });
  }, []);

  const loadInstances = useCallback(async () => {
    const res = await apiClient.get('/whatsapp/instances');
    if (res.data?.success) {
      setInstances(res.data.data || []);
    }
  }, []);

  const loadConversations = useCallback(async (cursor?: string | null, append = false) => {
    setLoadingConversations(!append);
    try {
      const params = new URLSearchParams({ limit: '40' });
      if (cursor) params.set('cursor', cursor);
      const res = await apiClient.get(`/whatsapp/conversations?${params}`);
      if (res.data?.success) {
        const page = res.data.data;
        const items: Conversation[] = page.items || [];
        setConversations((prev) => (append ? [...prev, ...items] : items));
        setConversationsCursor(page.nextCursor || null);
        setConversationsHasMore(!!page.hasMore);
      }
    } catch {
      showToast.error('Erro ao carregar conversas');
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  const loadMessages = useCallback(
    async (instanceId: number, contact: string, cursor?: string | null, prepend = false) => {
      const params = new URLSearchParams({ contact, limit: '40' });
      if (cursor) params.set('cursor', cursor);
      const res = await apiClient.get(`/whatsapp/instances/${instanceId}/messages?${params}`);
      if (!res.data?.success) return;

      const page = res.data.data;
      const items: ChatMessage[] = (page.items || []).map((msg: any) => ({
        id: msg.id || msg.messageId,
        messageId: msg.messageId,
        clientMessageId: msg.clientMessageId,
        text: msg.text,
        fromMe: msg.fromMe,
        timestamp: msg.timestamp,
        status: msg.status || 'SENT',
        mediaUrl: msg.mediaUrl,
        mediaType: msg.mediaType,
      }));

      if (prepend) {
        const container = messagesContainerRef.current;
        const prevHeight = container?.scrollHeight ?? 0;
        setMessages((prev) => {
          const existing = new Set(prev.map((m) => m.messageId));
          const unique = items.filter((m) => !existing.has(m.messageId));
          unique.forEach((m) => seenMessageIds.current.add(m.messageId));
          return [...unique, ...prev];
        });
        requestAnimationFrame(() => {
          if (container) {
            container.scrollTop = container.scrollHeight - prevHeight;
          }
        });
      } else {
        seenMessageIds.current = new Set(items.map((m) => m.messageId));
        setMessages(items);
        stickToBottomRef.current = true;
      }

      setMessagesCursor(page.nextCursor || null);
      setMessagesHasMore(!!page.hasMore);
    },
    []
  );

  // Boot: channel status → conversations
  useEffect(() => {
    const boot = async () => {
      try {
        await loadInstances();
        await loadConversations();
      } catch {
        showToast.error('Erro ao inicializar dados do Bate-Papo');
      }
    };
    void boot();
    const poll = window.setInterval(() => {
      void loadInstances();
    }, 15000);
    return () => clearInterval(poll);
  }, [loadInstances, loadConversations]);

  // Snapshot + SSE when contact/channel selected
  useEffect(() => {
    if (!selectedInstanceId || !selectedContact) return;
    void loadMessages(selectedInstanceId, selectedContact);
  }, [selectedInstanceId, selectedContact, loadMessages]);

  useEffect(() => {
    if (!selectedInstanceId || !token) return;

    const sseUrl = `${apiBase()}/whatsapp/instances/${selectedInstanceId}/messages/stream?token=${token}`;
    const eventSource = new EventSource(sseUrl);

    eventSource.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        const fromNumber = String(data.fromNumber || '').replace(/\D/g, '');
        const messageId = data.messageId as string;
        if (!messageId) return;

        const incoming: ChatMessage = {
          id: messageId,
          messageId,
          text: data.text,
          fromMe: !!data.fromMe,
          timestamp: data.timestamp || Date.now(),
          status: (data.status as MessageStatus) || 'DELIVERED',
          mediaUrl: data.mediaUrl,
          mediaType: data.mediaType,
        };

        if (selectedContact && fromNumber === selectedContact.replace(/\D/g, '')) {
          upsertMessage(incoming);
          stickToBottomRef.current = true;
        }

        setConversations((prev) => {
          const idx = prev.findIndex((c) => c.contactPhone.replace(/\D/g, '') === fromNumber);
          const bump: Conversation = {
            contactPhone: fromNumber,
            contactName: idx >= 0 ? prev[idx].contactName : `+${fromNumber}`,
            instanceId: selectedInstanceId,
            lastMessageText: data.text || null,
            lastMessageAt: data.timestamp || Date.now(),
            lastFromMe: !!data.fromMe,
            lastStatus: (data.status as MessageStatus) || 'DELIVERED',
            unreadCount:
              selectedContact?.replace(/\D/g, '') === fromNumber
                ? 0
                : (idx >= 0 ? prev[idx].unreadCount : 0) + 1,
          };
          if (idx < 0) return [bump, ...prev];
          const next = [...prev];
          next.splice(idx, 1);
          return [bump, ...next];
        });
      } catch {
        // ignore malformed SSE payloads
      }
    });

    eventSource.addEventListener('message:status', (event) => {
      try {
        const data = JSON.parse(event.data);
        setMessages((prev) =>
          prev.map((m) =>
            m.messageId === data.messageId ? { ...m, status: data.status as MessageStatus } : m
          )
        );
      } catch {
        // ignore
      }
    });

    return () => {
      eventSource.close();
    };
  }, [selectedInstanceId, token, selectedContact, upsertMessage]);

  useEffect(() => {
    if (stickToBottomRef.current) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, selectedContact]);

  const handleSelectConversation = (conv: Conversation) => {
    setSelectedContact(conv.contactPhone);
    setSelectedInstanceId(conv.instanceId);
    setMessages([]);
    setMessagesCursor(null);
    setMessagesHasMore(false);
    setConversations((prev) =>
      prev.map((c) =>
        c.contactPhone === conv.contactPhone ? { ...c, unreadCount: 0 } : c
      )
    );
  };

  const handleLoadOlder = async () => {
    if (!selectedInstanceId || !selectedContact || !messagesHasMore || !messagesCursor || loadingOlder) {
      return;
    }
    setLoadingOlder(true);
    stickToBottomRef.current = false;
    try {
      await loadMessages(selectedInstanceId, selectedContact, messagesCursor, true);
    } finally {
      setLoadingOlder(false);
    }
  };

  const handleMessagesScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (el.scrollTop < 40 && messagesHasMore && !loadingOlder) {
      void handleLoadOlder();
    }
  };

  const handleSendMessage = async (retryClientId?: string, retryText?: string) => {
    const text = (retryText ?? inputText).trim();
    if (!selectedContact || (!text && !selectedFile) || !selectedInstanceId || sending) return;

    if (!channelConnected) {
      showToast.error('Canal desconectado. Reconecte o WhatsApp antes de enviar.');
      return;
    }

    const clientMessageId = retryClientId || `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    if (!retryClientId) {
      const optimistic: ChatMessage = {
        id: clientMessageId,
        messageId: clientMessageId,
        clientMessageId,
        text: text || undefined,
        fromMe: true,
        timestamp: Date.now(),
        status: 'PENDING',
        mediaUrl: filePreview || undefined,
        mediaType: selectedFile?.type,
      };
      upsertMessage(optimistic);
      setInputText('');
      stickToBottomRef.current = true;
    } else {
      setMessages((prev) =>
        prev.map((m) =>
          m.clientMessageId === clientMessageId ? { ...m, status: 'PENDING' } : m
        )
      );
    }

    setSending(true);
    try {
      if (selectedFile && !retryClientId) {
        const formData = new FormData();
        formData.append('phoneNumber', selectedContact);
        formData.append('caption', text);
        formData.append('file', selectedFile);
        setSelectedFile(null);
        setFilePreview(null);

        const res = await apiClient.post(
          `/whatsapp/instances/${selectedInstanceId}/send-media`,
          formData,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );
        if (res.data?.data) {
          const dto = res.data.data;
          upsertMessage({
            id: dto.id || dto.messageId,
            messageId: dto.messageId,
            clientMessageId,
            text: dto.text,
            fromMe: true,
            timestamp: dto.timestamp,
            status: dto.status || 'SENT',
            mediaUrl: dto.mediaUrl,
            mediaType: dto.mediaType,
          });
        }
      } else {
        const res = await apiClient.post(`/whatsapp/instances/${selectedInstanceId}/send-message`, {
          phoneNumber: selectedContact,
          message: text,
          clientMessageId,
        });
        if (res.data?.data) {
          const dto = res.data.data;
          upsertMessage({
            id: dto.id || dto.messageId,
            messageId: dto.messageId,
            clientMessageId: dto.clientMessageId || clientMessageId,
            text: dto.text,
            fromMe: true,
            timestamp: dto.timestamp,
            status: dto.status || 'SENT',
            mediaUrl: dto.mediaUrl,
            mediaType: dto.mediaType,
          });
        }
      }

      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.contactPhone === selectedContact);
        const bump: Conversation = {
          contactPhone: selectedContact!,
          contactName: idx >= 0 ? prev[idx].contactName : `+${selectedContact}`,
          instanceId: selectedInstanceId!,
          lastMessageText: text || '[mídia]',
          lastMessageAt: Date.now(),
          lastFromMe: true,
          lastStatus: 'SENT',
          unreadCount: 0,
        };
        if (idx < 0) return [bump, ...prev];
        const next = [...prev];
        next.splice(idx, 1);
        return [bump, ...next];
      });
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        (err?.response?.status === 503
          ? 'Canal desconectado. Reconecte antes de enviar.'
          : 'Erro ao enviar mensagem');
      showToast.error(msg);
      setMessages((prev) =>
        prev.map((m) =>
          m.clientMessageId === clientMessageId ? { ...m, status: 'FAILED' } : m
        )
      );
    } finally {
      setSending(false);
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
    if (!number) return;
    const cleanNumber = number.replace(/\D/g, '');
    if (cleanNumber.length < 10) {
      showToast.error('Número inválido');
      return;
    }

    const openInstance =
      instances.find((i) => isChannelOpen(i.liveStatus?.state)) || instances[0] || null;

    if (!openInstance) {
      showToast.error('Nenhum canal disponível. Conecte um WhatsApp primeiro.');
      return;
    }

    setConversations((prev) => {
      if (prev.some((c) => c.contactPhone === cleanNumber)) return prev;
      return [
        {
          contactPhone: cleanNumber,
          contactName: `+${cleanNumber}`,
          instanceId: openInstance.id,
          lastMessageText: null,
          lastMessageAt: Date.now(),
          lastFromMe: true,
          lastStatus: null,
          unreadCount: 0,
        },
        ...prev,
      ];
    });
    setSelectedContact(cleanNumber);
    setSelectedInstanceId(openInstance.id);
    setMessages([]);
  };

  const filteredConversations = conversations.filter((c) => {
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    return (
      (c.contactName || '').toLowerCase().includes(q) ||
      c.contactPhone.includes(searchQuery)
    );
  });

  const resolveMediaUrl = (url: string) =>
    url.startsWith('data:') || url.startsWith('http') ? url : `${mediaBase()}${url}`;

  return (
    <>
      <style>{`
        .page-content-wrapper-box {
          max-width: none !important;
          width: 100% !important;
          margin: 0 !important;
        }
      `}</style>
      <div
        style={{
          margin: 'calc(var(--page-pad) * -1)',
          height: 'calc(100vh - 72px)',
          display: 'flex',
          backgroundColor: 'var(--surface)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: 320,
            borderRight: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--app-bg)',
          }}
        >
          <div
            style={{
              padding: '20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ position: 'relative', flex: 1, marginRight: 12 }}>
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                type="text"
                placeholder="Buscar conversa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input"
                style={{
                  padding: '8px 12px 8px 36px',
                  width: '100%',
                  borderRadius: 8,
                  fontSize: '0.9rem',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--app-bg)',
                }}
              />
            </div>
            <Button variant="secondary" onClick={handleNewChat} style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
              + Novo
            </Button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {loadingConversations ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Carregando conversas…
              </div>
            ) : filteredConversations.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Nenhuma conversa ainda.
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <div
                  key={conv.contactPhone}
                  onClick={() => handleSelectConversation(conv)}
                  style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    backgroundColor:
                      selectedContact === conv.contactPhone ? 'var(--primary-alpha)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    transition: 'background-color 0.2s',
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      minWidth: 40,
                      height: 40,
                      borderRadius: '50%',
                      backgroundColor: 'var(--surface-hover)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <User size={20} color="var(--text-muted)" />
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span>{conv.contactName || `+${conv.contactPhone}`}</span>
                      {conv.unreadCount > 0 && (
                        <span
                          style={{
                            background: 'var(--primary)',
                            color: '#fff',
                            borderRadius: 10,
                            fontSize: '0.7rem',
                            minWidth: 18,
                            height: 18,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '0 6px',
                          }}
                        >
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: '0.85rem',
                        color: 'var(--text-muted)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {conv.lastMessageText || 'Iniciar conversa'}
                    </div>
                  </div>
                </div>
              ))
            )}
            {conversationsHasMore && (
              <Button
                variant="secondary"
                onClick={() => void loadConversations(conversationsCursor, true)}
                style={{ margin: 12 }}
              >
                Carregar mais
              </Button>
            )}
          </div>
        </div>

        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'color-mix(in srgb, var(--surface) 50%, var(--app-bg))',
          }}
        >
          <div
            style={{
              padding: '12px 24px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--surface)',
              minHeight: 64,
            }}
          >
            {selectedContact ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    minWidth: 40,
                    height: 40,
                    borderRadius: '50%',
                    backgroundColor: 'var(--primary-alpha)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <User size={20} color="var(--primary)" />
                </div>
                <div>
                  <h3 style={{ fontWeight: 600, fontSize: '1.1rem' }}>
                    {conversations.find((c) => c.contactPhone === selectedContact)?.contactName ||
                      `+${selectedContact}`}
                  </h3>
                  {!channelConnected && selectedInstanceId && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--warning)' }}>Canal desconectado</div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Bate-Papo</div>
            )}

            <div>
              {selectedContact && (
                <Button
                  variant="secondary"
                  onClick={() => setIsInstanceModalOpen(true)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    fontSize: '0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    border: channelConnected ? '1px solid var(--border)' : '1px dashed var(--warning)',
                    color: channelConnected ? undefined : 'var(--warning)',
                  }}
                >
                  <Smartphone size={18} />
                  {selectedInstance?.name || 'Selecionar Canal'}
                  <ChevronDown size={16} style={{ marginLeft: 4 }} />
                </Button>
              )}
            </div>
          </div>

          {selectedContact ? (
            <>
              <div
                ref={messagesContainerRef}
                onScroll={handleMessagesScroll}
                style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}
              >
                {messagesHasMore && (
                  <div style={{ textAlign: 'center' }}>
                    <Button variant="secondary" onClick={() => void handleLoadOlder()} disabled={loadingOlder} style={{ fontSize: '0.85rem' }}>
                      {loadingOlder ? 'Carregando…' : 'Carregar mensagens anteriores'}
                    </Button>
                  </div>
                )}
                {messages.length ? (
                  messages.map((msg) => (
                    <div
                      key={msg.messageId || msg.id}
                      style={{
                        alignSelf: msg.fromMe ? 'flex-end' : 'flex-start',
                        backgroundColor: msg.fromMe
                          ? msg.status === 'FAILED'
                            ? 'color-mix(in srgb, var(--error) 80%, #000)'
                            : 'var(--primary)'
                          : 'var(--surface)',
                        color: msg.fromMe ? '#fff' : 'inherit',
                        padding: '12px 18px',
                        borderRadius: 18,
                        borderBottomRightRadius: msg.fromMe ? 4 : 18,
                        borderBottomLeftRadius: !msg.fromMe ? 4 : 18,
                        maxWidth: '75%',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                        position: 'relative',
                      }}
                    >
                      {msg.mediaUrl && (
                        <div style={{ marginBottom: msg.text ? 8 : 0 }}>
                          {msg.mediaType?.startsWith('image/') && (
                            <img
                              src={resolveMediaUrl(msg.mediaUrl)}
                              alt="attachment"
                              style={{
                                maxWidth: '100%',
                                borderRadius: 8,
                                cursor: 'pointer',
                                maxHeight: 200,
                                objectFit: 'cover',
                              }}
                              onClick={() => setMediaModal({ url: msg.mediaUrl!, type: 'image' })}
                            />
                          )}
                          {msg.mediaType?.startsWith('video/') && (
                            <div
                              style={{
                                width: 200,
                                height: 120,
                                backgroundColor: '#000',
                                borderRadius: 8,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                              }}
                              onClick={() => setMediaModal({ url: msg.mediaUrl!, type: 'video' })}
                            >
                              <Play size={32} color="#fff" />
                            </div>
                          )}
                          {msg.mediaType?.startsWith('audio/') && (
                            <audio controls style={{ maxWidth: '100%', height: 40 }} src={resolveMediaUrl(msg.mediaUrl)} />
                          )}
                          {msg.mediaType?.startsWith('application/pdf') && (
                            <div
                              style={{
                                padding: 12,
                                backgroundColor: msg.fromMe ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.05)',
                                borderRadius: 8,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                cursor: 'pointer',
                              }}
                              onClick={() => setMediaModal({ url: msg.mediaUrl!, type: 'pdf' })}
                            >
                              <FileText size={24} />
                              <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Documento PDF</span>
                            </div>
                          )}
                        </div>
                      )}
                      {msg.text && <div style={{ wordBreak: 'break-word', lineHeight: '1.4' }}>{msg.text}</div>}
                      <div
                        style={{
                          fontSize: '0.7rem',
                          opacity: 0.7,
                          marginTop: 6,
                          textAlign: 'right',
                          display: 'flex',
                          justifyContent: 'flex-end',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {msg.fromMe && (
                          <span style={{ opacity: msg.status === 'READ' ? 1 : 0.85 }} title={msg.status}>
                            {statusLabel(msg.status)}
                          </span>
                        )}
                        {msg.fromMe && msg.status === 'FAILED' && (
                          <button
                            type="button"
                            onClick={() => void handleSendMessage(msg.clientMessageId, msg.text)}
                            title="Reenviar"
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#fff',
                              cursor: 'pointer',
                              padding: 0,
                              display: 'inline-flex',
                            }}
                          >
                            <RefreshCw size={12} />
                          </button>
                        )}
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

              <div
                style={{
                  padding: '20px 24px',
                  borderTop: '1px solid var(--border)',
                  backgroundColor: 'var(--surface)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                {!channelConnected && (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: 8,
                      background: 'color-mix(in srgb, var(--warning) 14%, transparent)',
                      color: 'var(--text)',
                      fontSize: '0.9rem',
                    }}
                  >
                    Canal desconectado — envio bloqueado até reconectar o WhatsApp.
                  </div>
                )}
                {selectedFile && (
                  <div
                    style={{
                      padding: 12,
                      backgroundColor: 'var(--app-bg)',
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      position: 'relative',
                    }}
                  >
                    {filePreview ? (
                      <img src={filePreview} alt="preview" style={{ width: 40, height: 40, borderRadius: 4, objectFit: 'cover' }} />
                    ) : (
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 4,
                          backgroundColor: 'var(--primary-alpha)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <FileText size={20} color="var(--primary)" />
                      </div>
                    )}
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div
                        style={{
                          fontWeight: 500,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          fontSize: '0.9rem',
                        }}
                      >
                        {selectedFile.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedFile(null);
                        setFilePreview(null);
                      }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                    >
                      <X size={18} color="var(--text-muted)" />
                    </button>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                  <input type="file" ref={fileInputRef} onChange={handleFileSelect} style={{ display: 'none' }} />
                  <Button
                    variant="secondary"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!channelConnected}
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: '50%',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      backgroundColor: 'var(--app-bg)',
                      border: '1px solid var(--border)',
                    }}
                    title="Anexar arquivo"
                  >
                    <Paperclip size={22} color="var(--text-muted)" />
                  </Button>

                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void handleSendMessage();
                      }
                    }}
                    placeholder={
                      !channelConnected
                        ? 'Canal desconectado…'
                        : selectedFile
                          ? 'Adicione uma legenda...'
                          : 'Digite uma mensagem...'
                    }
                    disabled={!channelConnected}
                    className="form-input"
                    style={{ flex: 1, resize: 'none', height: 52, padding: '14px 20px', borderRadius: 26, overflow: 'hidden' }}
                  />

                  <Button
                    onClick={() => void handleSendMessage()}
                    disabled={(!inputText.trim() && !selectedFile) || !channelConnected || sending}
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: '50%',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                    title="Enviar"
                  >
                    <Send size={22} />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
              }}
            >
              <MessageSquare size={64} style={{ marginBottom: 20, opacity: 0.15 }} />
              <h3 style={{ fontSize: '1.2rem', marginBottom: 8 }}>Seu Bate-papo</h3>
              <p>Selecione uma conversa ao lado ou inicie uma nova.</p>
            </div>
          )}
        </div>
      </div>

      {isInstanceModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(2px)',
          }}
          onClick={() => setIsInstanceModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--surface)',
              padding: 32,
              borderRadius: 16,
              width: 500,
              maxWidth: '90%',
              boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginBottom: 24, fontSize: '1.4rem' }}>Selecionar Canal WhatsApp</h2>
            {instances.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>Nenhum canal cadastrado. Crie um em Conexões.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
                {instances.map((inst) => {
                  const open = isChannelOpen(inst.liveStatus?.state);
                  return (
                    <div
                      key={inst.id}
                      onClick={() => {
                        setSelectedInstanceId(inst.id);
                        setIsInstanceModalOpen(false);
                        if (selectedContact) {
                          void loadMessages(inst.id, selectedContact);
                        }
                      }}
                      style={{
                        padding: 24,
                        borderRadius: 12,
                        border: '1px solid var(--border)',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.2s',
                        backgroundColor:
                          selectedInstanceId === inst.id ? 'var(--primary-alpha)' : 'var(--surface-hover)',
                        borderColor: selectedInstanceId === inst.id ? 'var(--primary)' : 'var(--border)',
                        opacity: open ? 1 : 0.7,
                      }}
                    >
                      <Smartphone
                        size={32}
                        color={selectedInstanceId === inst.id ? 'var(--primary)' : 'var(--text-muted)'}
                        style={{ margin: '0 auto 12px' }}
                      />
                      <div style={{ fontWeight: 600 }}>{inst.name}</div>
                      <div style={{ fontSize: '0.8rem', color: open ? 'var(--success)' : 'var(--warning)', marginTop: 6 }}>
                        {open ? 'Conectado' : 'Desconectado'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ marginTop: 32, textAlign: 'right' }}>
              <Button variant="secondary" onClick={() => setIsInstanceModalOpen(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      {mediaModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.85)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setMediaModal(null)}
        >
          <button
            onClick={() => setMediaModal(null)}
            style={{ position: 'absolute', top: 24, right: 24, background: 'none', border: 'none', cursor: 'pointer', color: '#fff' }}
          >
            <X size={32} />
          </button>

          <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: '90%', maxHeight: '90%', display: 'flex', justifyContent: 'center' }}>
            {mediaModal.type === 'image' && (
              <img
                src={resolveMediaUrl(mediaModal.url)}
                alt="Fullscreen"
                style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain' }}
              />
            )}
            {mediaModal.type === 'video' && (
              <video src={resolveMediaUrl(mediaModal.url)} controls autoPlay style={{ maxWidth: '100%', maxHeight: '90vh' }} />
            )}
            {mediaModal.type === 'pdf' && (
              <iframe
                src={resolveMediaUrl(mediaModal.url)}
                style={{ width: '80vw', height: '90vh', border: 'none', backgroundColor: '#fff' }}
                title="PDF Viewer"
              />
            )}
          </div>
        </div>
      )}
    </>
  );
};
