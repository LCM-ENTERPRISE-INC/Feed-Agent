import { WarmupPhase } from '../interfaces/warmup.types';

export class CreateWarmupProfileDto {
  instanceId!: string;
  name!: string;
  initialPhase?: WarmupPhase;
}

export class UpdateWarmupProfileDto {
  name?: string;
  currentPhase?: WarmupPhase;
  dailyLimit?: number;
}
