import mongoose, { Document, Schema } from 'mongoose';

export interface IChatMessage extends Document {
  instanceId: number;
  fromNumber: string;
  text?: string;
  fromMe: boolean;
  timestamp: number;
  messageId: string;
  mediaUrl?: string;
  mediaType?: string;
}

const ChatMessageSchema: Schema = new Schema(
  {
    instanceId: { type: Number, required: true, index: true },
    fromNumber: { type: String, required: true, index: true },
    text: { type: String, required: false },
    fromMe: { type: Boolean, required: true },
    timestamp: { type: Number, required: true, index: true },
    messageId: { type: String, required: true, unique: true },
    mediaUrl: { type: String, required: false },
    mediaType: { type: String, required: false }
  },
  {
    timestamps: true, // Automatically manage createdAt and updatedAt
  }
);

// Compound index for fast queries when opening a chat
ChatMessageSchema.index({ instanceId: 1, fromNumber: 1, timestamp: 1 });

const ChatMessage = mongoose.model<IChatMessage>('ChatMessage', ChatMessageSchema);

export default ChatMessage;
