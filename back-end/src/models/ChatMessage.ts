import mongoose, { Document, Schema } from 'mongoose';

export type ChatMessageStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

export interface IChatMessage extends Document {
  userId: number;
  instanceId: number;
  /** Peer phone (digits only) — recipient for outbound, sender for inbound. */
  fromNumber: string;
  text?: string;
  fromMe: boolean;
  timestamp: number;
  messageId: string;
  clientMessageId?: string;
  status: ChatMessageStatus;
  mediaUrl?: string;
  mediaType?: string;
  /** Inbound messages not yet opened in the UI. */
  unread: boolean;
  errorCode?: string;
}

const ChatMessageSchema: Schema = new Schema(
  {
    userId: { type: Number, required: true, index: true },
    instanceId: { type: Number, required: true, index: true },
    fromNumber: { type: String, required: true, index: true },
    text: { type: String, required: false },
    fromMe: { type: Boolean, required: true },
    timestamp: { type: Number, required: true, index: true },
    messageId: { type: String, required: true, unique: true },
    clientMessageId: { type: String, required: false, index: true },
    status: {
      type: String,
      enum: ['PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED'],
      default: 'SENT',
      index: true,
    },
    mediaUrl: { type: String, required: false },
    mediaType: { type: String, required: false },
    unread: { type: Boolean, default: false, index: true },
    errorCode: { type: String, required: false },
  },
  {
    timestamps: true,
  }
);

ChatMessageSchema.index({ instanceId: 1, fromNumber: 1, timestamp: 1 });
ChatMessageSchema.index({ userId: 1, fromNumber: 1, timestamp: -1 });
ChatMessageSchema.index({ userId: 1, timestamp: -1 });
ChatMessageSchema.index({ userId: 1, clientMessageId: 1 }, { unique: true, sparse: true });

const ChatMessage = mongoose.model<IChatMessage>('ChatMessage', ChatMessageSchema);

export default ChatMessage;
