import { FeedHistory, IFeedHistory } from '../models/FeedHistory';
import logger from '../utils/logger';

export class FeedHistoryService {
  /**
   * Logs a message attempt to the history.
   */
  async logMessage(data: {
    draftId: number;
    userId: number;
    contactNumber: string;
    messageContent: string;
    status: IFeedHistory['status'];
    errorDetails?: string;
    messageId?: string;
  }): Promise<IFeedHistory> {
    try {
      const historyRecord = new FeedHistory(data);
      return await historyRecord.save();
    } catch (error) {
      logger.error(`[feed-history-service]: Failed to log message for contact ${data.contactNumber}: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Updates the status of an existing message log.
   */
  async updateMessageStatus(
    logId: string, 
    status: IFeedHistory['status'], 
    errorDetails?: string,
    messageId?: string
  ): Promise<void> {
    try {
      await FeedHistory.findByIdAndUpdate(logId, {
        $set: { 
          status, 
          ...(errorDetails ? { errorDetails } : {}),
          ...(messageId ? { messageId } : {})
        }
      }).exec();
    } catch (error) {
      logger.error(`[feed-history-service]: Failed to update message status for log ${logId}: ${(error as Error).message}`);
      // non-fatal, shouldn't crash the worker
    }
  }

  /**
   * Updates the status of a log by its messageId (useful for async webhooks/receipts)
   */
  async updateStatusByMessageId(messageId: string, status: IFeedHistory['status']): Promise<void> {
    try {
      // Only upgrade status (e.g. sent -> delivered -> read)
      // Since it's linear: 'sent' -> 'delivered' -> 'read', we don't want to downgrade.
      await FeedHistory.findOneAndUpdate(
        { messageId },
        { $set: { status } }
      ).exec();
    } catch (error) {
      logger.error(`[feed-history-service]: Failed to update by messageId ${messageId}: ${(error as Error).message}`);
    }
  }

  /**
   * Retrieves the broadcast history for a specific user, paginated.
   */
  async getUserHistory(userId: number, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    
    // Leverage the indexes created on userId and timestamp
    const [data, total] = await Promise.all([
      FeedHistory.find({ userId })
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      FeedHistory.countDocuments({ userId }).exec()
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }
  /**
   * Generates Daily KPIs using MongoDB Aggregation Pipeline.
   * Returns total sent today and success rate.
   */
  async getDailyKPIs(userId: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const pipeline = [
      {
        $match: {
          userId,
          timestamp: { $gte: today }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ];

    const results = await FeedHistory.aggregate(pipeline).exec();

    let totalSent = 0;
    let totalFailed = 0;

    results.forEach(item => {
      if (item._id === 'sent' || item._id === 'delivered' || item._id === 'read') {
        totalSent += item.count;
      } else if (item._id === 'failed') {
        totalFailed += item.count;
      }
    });

    const totalProcessed = totalSent + totalFailed;
    const successRate = totalProcessed === 0 ? 0 : Number(((totalSent / totalProcessed) * 100).toFixed(2));

    return {
      totalReachedToday: totalSent,
      successRateToday: successRate
    };
  }

  /**
   * Top recipients by successful sends for one user.
   * Counts only status: sent | delivered | read. Isolated by userId.
   */
  async getTopRecipients(userId: number, limit: number = 5): Promise<Array<{
    phoneNumber: string;
    sendCount: number;
    lastDeliveryAt: Date | null;
  }>> {
    const safeLimit = Math.min(20, Math.max(1, limit));
    const rows = await FeedHistory.aggregate([
      {
        $match: {
          userId,
          status: { $in: ['sent', 'delivered', 'read'] },
        },
      },
      {
        $group: {
          _id: '$contactNumber',
          sendCount: { $sum: 1 },
          lastDeliveryAt: { $max: '$timestamp' },
        },
      },
      { $sort: { sendCount: -1 } },
      { $limit: safeLimit },
    ]).exec();

    return rows.map((row) => ({
      phoneNumber: String(row._id),
      sendCount: Number(row.sendCount) || 0,
      lastDeliveryAt: row.lastDeliveryAt ? new Date(row.lastDeliveryAt) : null,
    }));
  }
}

export default new FeedHistoryService();
