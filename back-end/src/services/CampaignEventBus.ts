import { EventEmitter } from 'events';

export type CampaignSseEvent = {
  type: string;
  campaignId: string;
  userId: number;
  payload?: Record<string, unknown>;
  at: string;
};

/**
 * In-process fan-out for campaign SSE subscribers (one backend replica).
 */
class CampaignEventBus extends EventEmitter {
  emitCampaign(event: CampaignSseEvent): void {
    this.emit(`user:${event.userId}`, event);
    this.emit(`campaign:${event.campaignId}`, event);
  }

  onUser(userId: number, listener: (e: CampaignSseEvent) => void): void {
    this.on(`user:${userId}`, listener);
  }

  offUser(userId: number, listener: (e: CampaignSseEvent) => void): void {
    this.off(`user:${userId}`, listener);
  }
}

export const campaignEventBus = new CampaignEventBus();
export default campaignEventBus;
