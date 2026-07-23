import { warmupLogger, logWarmupTransition } from '../utils/warmupLogger';

describe('WarmupLogger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined and configured as a winston logger', () => {
    expect(warmupLogger).toBeDefined();
    expect(warmupLogger.info).toBeInstanceOf(Function);
    expect(warmupLogger.error).toBeInstanceOf(Function);
  });

  it('should successfully log a transition', () => {
    const spyInfo = jest.spyOn(warmupLogger, 'info').mockImplementation();
    
    logWarmupTransition(10, 'PHASE_1', 'PHASE_2');
    
    expect(spyInfo).toHaveBeenCalledWith(
      'Transitioned from PHASE_1 to PHASE_2',
      { instanceId: 10, previousPhase: 'PHASE_1', newPhase: 'PHASE_2' }
    );
    
    spyInfo.mockRestore();
  });
});
