import { WarmupPhase, WarmupStatus } from '../interfaces/warmup.types';
import { CreateWarmupProfileDto, UpdateWarmupProfileDto } from '../dtos/warmup.dto';

describe('Warm-up Types and DTOs', () => {
  describe('WarmupPhase Enum', () => {
    it('should have correct values for the three phases', () => {
      expect(WarmupPhase.PHASE_1).toBe('PHASE_1');
      expect(WarmupPhase.PHASE_2).toBe('PHASE_2');
      expect(WarmupPhase.PHASE_3).toBe('PHASE_3');
    });
  });

  describe('WarmupStatus Enum', () => {
    it('should contain expected status types for safety and control', () => {
      expect(WarmupStatus.IDLE).toBe('IDLE');
      expect(WarmupStatus.WARMING).toBe('WARMING');
      expect(WarmupStatus.COOLING_DOWN).toBe('COOLING_DOWN');
      expect(WarmupStatus.BANNED).toBe('BANNED');
    });
  });

  describe('DTO Instantiation', () => {
    it('should allow instantiation of CreateWarmupProfileDto', () => {
      const dto = new CreateWarmupProfileDto();
      dto.instanceId = 'instance-123';
      dto.name = 'Test Warmup';
      dto.initialPhase = WarmupPhase.PHASE_1;
      
      expect(dto.instanceId).toBe('instance-123');
      expect(dto.initialPhase).toBe(WarmupPhase.PHASE_1);
    });

    it('should allow instantiation of UpdateWarmupProfileDto', () => {
      const dto = new UpdateWarmupProfileDto();
      dto.dailyLimit = 50;
      
      expect(dto.dailyLimit).toBe(50);
      expect(dto.name).toBeUndefined();
    });
  });
});
