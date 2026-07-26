"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WarmupCacheService = void 0;
const redisClient_1 = __importDefault(require("../../utils/redisClient"));
class WarmupCacheService {
    static NAMESPACE = 'warmup:state:';
    static HISTORY_NAMESPACE = 'warmup:history:';
    static getKey(instanceId) {
        return `${this.NAMESPACE}${instanceId}`;
    }
    static getHistoryKey(instanceId, jid) {
        return `${this.HISTORY_NAMESPACE}${instanceId}:${jid}`;
    }
    static async setState(instanceId, state, ttlSeconds = 86400) {
        const key = this.getKey(instanceId);
        await redisClient_1.default.set(key, JSON.stringify(state), 'EX', ttlSeconds);
    }
    static async getState(instanceId) {
        const key = this.getKey(instanceId);
        const data = await redisClient_1.default.get(key);
        if (!data)
            return null;
        try {
            return JSON.parse(data);
        }
        catch {
            return null;
        }
    }
    static async incrementMessagesSent(instanceId) {
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
    static async incrementMessagesReceived(instanceId) {
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
    static async incrementFailures(instanceId) {
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
    static async resetFailures(instanceId) {
        const currentState = await this.getState(instanceId);
        if (currentState && currentState.consecutiveFailures > 0) {
            currentState.consecutiveFailures = 0;
            await this.setState(instanceId, currentState);
        }
    }
    static async deleteState(instanceId) {
        const key = this.getKey(instanceId);
        await redisClient_1.default.del(key);
    }
    /**
     * Appends a message to the conversational history of a given instance and JID.
     * Keeps only the last 4 messages. TTL is 24 hours.
     */
    static async appendConversationHistory(instanceId, jid, message, sender) {
        const key = this.getHistoryKey(instanceId, jid);
        const historyEntry = JSON.stringify({ sender, message, timestamp: Date.now() });
        // Append to the list and trim to keep only the last 4 entries
        await redisClient_1.default.rpush(key, historyEntry);
        await redisClient_1.default.ltrim(key, -4, -1);
        // Set TTL to 24 hours (86400 seconds)
        await redisClient_1.default.expire(key, 86400);
    }
    /**
     * Retrieves the conversation history for a given instance and JID.
     */
    static async getConversationHistory(instanceId, jid) {
        const key = this.getHistoryKey(instanceId, jid);
        const data = await redisClient_1.default.lrange(key, 0, -1);
        if (!data || data.length === 0)
            return [];
        return data.map(item => JSON.parse(item));
    }
}
exports.WarmupCacheService = WarmupCacheService;
