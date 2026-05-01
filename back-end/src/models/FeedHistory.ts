import mongoose, { Schema, Document } from 'mongoose';

export interface IFeedHistory extends Document {
  draftId: number;
  userId: number;
  contactNumber: string;
  messageContent: string;
  status: 'pending' | 'sent' | 'failed' | 'delivered' | 'read';
  timestamp: Date;
  errorDetails?: string;
}

const FeedHistorySchema: Schema = new Schema({
  draftId: { type: Number, required: true },
  userId: { type: Number, required: true, index: true },
  contactNumber: { type: String, required: true },
  messageContent: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'sent', 'failed', 'delivered', 'read'], 
    default: 'pending' 
  },
  timestamp: { type: Date, default: Date.now, index: true },
  errorDetails: { type: String, required: false }
}, {
  timestamps: true // adds createdAt and updatedAt
});

export const FeedHistory = mongoose.model<IFeedHistory>('FeedHistory', FeedHistorySchema);
