import { WarmupEventTriggerService } from '../services/WarmupEventTriggerService';
import { WarmupQueue } from '../queues/WarmupQueue';
import { WarmupProfileService } from '../services/WarmupProfileService';
import { WarmupBackoffService } from '../services/WarmupBackoffService';
import { WarmupCacheService } from '../services/WarmupCacheService';
import { WarmupAuditService } from '../services/WarmupAuditService';
import LlamaService from '../../services/LlamaService';
import { WarmupPhase } from '@prisma/client';
import { proto } from '@whiskeysockets/baileys';

// Desativamos logs para não poluir o stdout durante o teste de carga
jest.mock('../utils/warmupLogger', () => ({
  warmupLogger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

jest.mock('../queues/WarmupQueue', () => ({
  WarmupQueue: {
    addEventReplyJob: jest.fn().mockResolvedValue(true)
  }
}));

jest.mock('../services/WarmupProfileService', () => ({
  WarmupProfileService: {
    getProfile: jest.fn().mockResolvedValue({
      currentPhase: 'PHASE_3',
      dailyLimit: 1500
    })
  }
}));

jest.mock('../services/WarmupCacheService', () => ({
  WarmupCacheService: {
    appendConversationHistory: jest.fn().mockResolvedValue(true),
    getConversationHistory: jest.fn().mockResolvedValue([]),
    getState: jest.fn().mockResolvedValue({ consecutiveFailures: 0 })
  }
}));

jest.mock('../services/WarmupAuditService', () => ({
  WarmupAuditService: {
    logInteraction: jest.fn()
  }
}));

jest.mock('../../services/LlamaService', () => ({
  __esModule: true,
  default: {
    // Simulando 10ms de processamento AI local
    generateCompletion: jest.fn().mockImplementation(() => {
      return new Promise(resolve => setTimeout(() => resolve('Simulated AI reply'), 10));
    })
  }
}));

describe('Warmup Load and Stress Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Sobrescrevendo o Math.random apenas para evitar os drops naturais e forçar o teste a processar tudo
    jest.spyOn(Math, 'random').mockReturnValue(0.9);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should process 1000 incoming messages across 50 instances in under 5 seconds', async () => {
    const INSTANCE_COUNT = 50;
    const MESSAGES_PER_INSTANCE = 20;
    
    // Preparar carga de trabalho
    const tasks: Promise<void>[] = [];
    const mockSocket = {} as any;

    for (let i = 0; i < INSTANCE_COUNT; i++) {
      const instanceId = `stress_inst_${i}`;
      
      for (let m = 0; m < MESSAGES_PER_INSTANCE; m++) {
        const msg: proto.IWebMessageInfo = {
          key: {
            remoteJid: `551199999${i.toString().padStart(4, '0')}@s.whatsapp.net`,
            fromMe: false,
          },
          message: {
            conversation: `Hello, message ${m} for instance ${i}`
          }
        };

        tasks.push(WarmupEventTriggerService.evaluateIncomingMessage(instanceId, msg, mockSocket));
      }
    }

    const startTime = Date.now();
    
    // Executa tudo concorrentemente (estresse no Event Loop)
    await Promise.all(tasks);
    
    const endTime = Date.now();
    const durationMs = endTime - startTime;

    // Asserções
    expect(WarmupQueue.addEventReplyJob).toHaveBeenCalledTimes(INSTANCE_COUNT * MESSAGES_PER_INSTANCE);
    expect(durationMs).toBeLessThan(5000);
    
    console.log(`[Load Test] Processed 1000 events in ${durationMs}ms`);
  }, 10000); // 10s timeout just in case
});
