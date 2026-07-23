import redisClient from '../../utils/redisClient';

export interface WarmupEphemeralState {
  isPaused: boolean;
  messagesSentInCurrentBatch: number;
  messagesReceivedInCurrentBatch: number;
  lastActionTimestamp: number;
  consecutiveFailures: number; // For Safety Backoff
}

export class WarmupCacheService {
  private static readonly NAMESPACE = 'warmup:state:';
  private static readonly HISTORY_NAMESPACE = 'warmup:history:';

  private static getKey(instanceId: string): string {
    return `${this.NAMESPACE}${instanceId}`;
  }

  private static getHistoryKey(instanceId: string, jid: string): string {
    return `${this.HISTORY_NAMESPACE}${instanceId}:${jid}`;
  }

  static async setState(instanceId: string, state: WarmupEphemeralState, ttlSeconds: number = 86400): Promise<void> {
    const key = this.getKey(instanceId);
    await redisClient.set(key, JSON.stringify(state), 'EX', ttlSeconds);
  }

  static async getState(instanceId: string): Promise<WarmupEphemeralState | null> {
    const key = this.getKey(instanceId);
    const data = await redisClient.get(key);
    if (!data) return null;
    try {
      return JSON.parse(data) as WarmupEphemeralState;
    } catch {
      return null;
    }
  }

  static async incrementMessagesSent(instanceId: string): Promise<number> {
    const currentState = await this.getState(instanceId) || {
      isPaused: false,
      messagesSentInCurrentBatch: 0,
      messagesReceivedInCurrentBatch: 0,
      lastActionTimestamp: Date.now(),
      consecutiveFailures: 0
    };
    
    currentState.messagesSentInCurrentBatch += 1;
    currentState.lastActionTimestamp = Date.now();
    
    await this.setState(instanceId, currentState);
    return currentState.messagesSentInCurrentBatch;
  }

  static async incrementMessagesReceived(instanceId: string): Promise<number> {
    const currentState = await this.getState(instanceId) || {
      isPaused: false,
      messagesSentInCurrentBatch: 0,
      messagesReceivedInCurrentBatch: 0,
      lastActionTimestamp: Date.now(),
      consecutiveFailures: 0
    };
    
    currentState.messagesReceivedInCurrentBatch += 1;
    currentState.lastActionTimestamp = Date.now();
    
    // Automatically unpause if it was paused due to asymmetry, since we just got a message
    if (currentState.isPaused) {
      currentState.isPaused = false;
    }
    
    await this.setState(instanceId, currentState);
    return currentState.messagesReceivedInCurrentBatch;
  }

  /**
   * Increments the consecutive failure count for an instance.
   */
  static async incrementFailures(instanceId: string): Promise<number> {
    const currentState = await this.getState(instanceId) || {
      isPaused: false,
      messagesSentInCurrentBatch: 0,
      messagesReceivedInCurrentBatch: 0,
      lastActionTimestamp: Date.now(),
      consecutiveFailures: 0
    };

    currentState.consecutiveFailures = (currentState.consecutiveFailures || 0) + 1;
    await this.setState(instanceId, currentState);
    return currentState.consecutiveFailures;
  }

  /**
   * Resets the consecutive failure count upon a successful action.
   */
  static async resetFailures(instanceId: string): Promise<void> {
    const currentState = await this.getState(instanceId);
    if (currentState && currentState.consecutiveFailures > 0) {
      currentState.consecutiveFailures = 0;
      await this.setState(instanceId, currentState);
    }
  }

  static async deleteState(instanceId: string): Promise<void> {
    const key = this.getKey(instanceId);
    await redisClient.del(key);
  }

  /**
   * Appends a message to the conversational history of a given instance and JID.
   * Keeps only the last 4 messages. TTL is 24 hours.
   */
  static async appendConversationHistory(instanceId: string, jid: string, message: string, sender: 'me' | 'other'): Promise<void> {
    const key = this.getHistoryKey(instanceId, jid);
    const historyEntry = JSON.stringify({ sender, message, timestamp: Date.now() });

    // Append to the list and trim to keep only the last 4 entries
    await redisClient.rpush(key, historyEntry);
    await redisClient.ltrim(key, -4, -1);
    
    // Set TTL to 24 hours (86400 seconds)
    await redisClient.expire(key, 86400);
  }

  /**
   * Retrieves the conversation history for a given instance and JID.
   */
  static async getConversationHistory(instanceId: string, jid: string): Promise<Array<{sender: 'me'|'other', message: string, timestamp: number}>> {
    const key = this.getHistoryKey(instanceId, jid);
    const data = await redisClient.lrange(key, 0, -1);
    if (!data || data.length === 0) return [];

    return data.map(item => JSON.parse(item));
  }
}
