export enum WarmupPhase {
  PHASE_1 = 'PHASE_1', // Dias 1 a 7 (Maturação e Confiança Básica)
  PHASE_2 = 'PHASE_2', // Dias 8 a 14 (Tração e Ganho de Volume)
  PHASE_3 = 'PHASE_3', // Dias 15 a 21 (Escala para Alta Performance)
}

export enum WarmupStatus {
  IDLE = 'IDLE',
  WARMING = 'WARMING',
  COOLING_DOWN = 'COOLING_DOWN',
  PAUSED = 'PAUSED',
  BANNED = 'BANNED',
  COMPLETED = 'COMPLETED',
}

export interface WarmupProfile {
  id?: string;
  instanceId: string;
  name: string;
  currentPhase: WarmupPhase;
  status: WarmupStatus;
  dailyLimit: number;
  messagesSentToday: number;
  startDate: Date;
  updatedAt?: Date;
}

export interface WarmupMetrics {
  messagesSent: number;
  messagesReceived: number;
  ratio: number;
  trustScore: number;
}
