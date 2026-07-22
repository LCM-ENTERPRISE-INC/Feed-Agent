import { maskPhone } from './phoneUtils';

/** Truncate and redact message body for structured logs (never log full text). */
export function maskMessagePreview(text?: string | null): string {
  if (!text) return '';
  const compact = text.replace(/\s+/g, ' ').trim();
  if (compact.length <= 24) return `[len=${compact.length}]`;
  return `[len=${compact.length} preview=${compact.slice(0, 12)}…]`;
}

export function chatLogFields(input: {
  userId?: number;
  instanceId?: number;
  phone?: string;
  messageId?: string;
  status?: string;
  text?: string | null;
}): Record<string, unknown> {
  return {
    userId: input.userId,
    instanceId: input.instanceId,
    phone: input.phone ? maskPhone(input.phone) : undefined,
    messageId: input.messageId ? `${String(input.messageId).slice(0, 8)}…` : undefined,
    status: input.status,
    body: maskMessagePreview(input.text),
  };
}
