import mongoose, { Schema, Document } from 'mongoose';

export interface IWarmupHistoryLog extends Document {
  instanceId: string;
  contactJid: string;
  direction: 'SENT' | 'RECEIVED';
  content: string;
  isAiGenerated: boolean;
  metadata?: Record<string, any>;
  createdAt: Date;
}

const WarmupHistoryLogSchema = new Schema<IWarmupHistoryLog>({
  instanceId: { type: String, required: true, index: true },
  contactJid: { type: String, required: true },
  direction: { type: String, enum: ['SENT', 'RECEIVED'], required: true },
  content: { type: String, required: true },
  isAiGenerated: { type: Boolean, default: false },
  metadata: { type: Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now, index: true } // Index for easy TTL/Sorting
});

// Optional: create a compound index for querying interactions by instance and contact quickly
WarmupHistoryLogSchema.index({ instanceId: 1, contactJid: 1, createdAt: -1 });

export const WarmupHistoryLog = mongoose.model<IWarmupHistoryLog>('WarmupHistoryLog', WarmupHistoryLogSchema, 'warmup_history_logs');
