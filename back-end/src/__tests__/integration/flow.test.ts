import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

jest.mock('../../services/OcrService');
jest.mock('../../services/NewsGeneratorService');
jest.mock('../../services/WhatsAppService', () => ({
  __esModule: true,
  default: {
    initialize: jest.fn().mockResolvedValue(true),
    sendMessage: jest.fn(),
    on: jest.fn()
  }
}));
jest.mock('bullmq', () => ({
  Worker: jest.fn().mockImplementation(() => ({
    on: jest.fn()
  })),
  Queue: jest.fn()
}));
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    quit: jest.fn(),
    status: 'ready'
  }));
});
jest.mock('bcrypt', () => ({
  compare: jest.fn().mockResolvedValue(true),
  hash: jest.fn().mockResolvedValue('hashed_password')
}));
const mockPrisma = {
  $connect: jest.fn(),
  $disconnect: jest.fn(),
  $transaction: jest.fn().mockImplementation(async (queries) => {
    return Promise.all(queries);
  }),
  user: {
    create: jest.fn().mockResolvedValue({ id: 999, name: 'Integration Test User', email: 'integration@test.com' }),
    findUnique: jest.fn().mockResolvedValue({ id: 999, passwordHash: '$2b$10$TESTHASH', email: 'integration@test.com' }),
    deleteMany: jest.fn()
  },
  draft: {
    create: jest.fn().mockResolvedValue({ id: 888, status: 'PENDING' }),
    findFirst: jest.fn().mockResolvedValue({ id: 888, userId: 999, status: 'PENDING' }),
    update: jest.fn().mockResolvedValue({ id: 888, status: 'APPROVED' }),
    deleteMany: jest.fn()
  },
  contact: {
    findMany: jest.fn().mockResolvedValue([{ id: 10, phoneNumber: '5511999990001', name: 'John Doe', active: true }]),
    count: jest.fn().mockResolvedValue(1)
  }
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
  DraftStatus: { PENDING: 'PENDING', APPROVED: 'APPROVED', REJECTED: 'REJECTED', CANCELLED: 'CANCELLED' }
}));
jest.mock('../../models/prismaClient', () => ({
  __esModule: true,
  default: mockPrisma
}));
jest.mock('../../queues/broadcastQueue', () => ({
  broadcastQueue: {
    add: jest.fn(),
    getWaiting: jest.fn().mockResolvedValue([]),
    getDelayed: jest.fn().mockResolvedValue([]),
  },
  BROADCAST_QUEUE_NAME: 'broadcast-queue'
}));

import { app } from '../../index';
import prisma from '../../models/prismaClient';
import ocrService from '../../services/OcrService';
import newsGeneratorService from '../../services/NewsGeneratorService';
import { broadcastQueue } from '../../queues/broadcastQueue';
import fs from 'fs';
import path from 'path';

let mongoServer: MongoMemoryServer;
let userToken: string;
let createdUserId: number;

beforeAll(async () => { jest.setTimeout(120000);
  // 1. Setup In-Memory MongoDB
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);

  // 2. Clean up any leftover test data in PostgreSQL just in case
  await prisma.draft.deleteMany({ where: { user: { email: 'integration@test.com' } } });
  await prisma.user.deleteMany({ where: { email: 'integration@test.com' } });
});

afterAll(async () => {
  // 1. Clean up test data
  await prisma.draft.deleteMany({ where: { userId: createdUserId } });
  await prisma.user.deleteMany({ where: { email: 'integration@test.com' } });
  
  // 2. Disconnect Databases
  await mongoose.disconnect();
  await mongoServer.stop();
  await prisma.$disconnect();
});

let createdDraftId: number;

describe('Full System Flow Integration Test', () => {
  it('1. Should register a new user', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Integration Test User',
        email: 'integration@test.com',
        password: 'password123'
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('token');
    expect(res.body.data.user).toHaveProperty('id');
    
    userToken = res.body.data.token;
    createdUserId = res.body.data.user.id;
  });

  it('2. Should log in the user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'integration@test.com',
        password: 'password123'
      });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('token');
  });

  it('3. Should mock OCR and LLM to generate a draft synchronously', async () => {
    // Mock the external service returns
    (ocrService.extractText as jest.Mock).mockResolvedValue({
      text: 'Mocked OCR Text from image.',
      confidence: 95.5
    });

    (newsGeneratorService.generateNewsFromOcr as jest.Mock).mockResolvedValue({
      titulo: 'Mocked Title',
      resumo: 'Mocked Summary',
      fonte: 'Mocked Source'
    });

    // Create a dummy file for upload
    const dummyFilePath = path.join(__dirname, 'dummy.jpg');
    fs.writeFileSync(dummyFilePath, 'dummy content');

    const res = await request(app)
      .post('/api/news/generate-draft')
      .set('Authorization', `Bearer ${userToken}`)
      .attach('file', dummyFilePath);

    // Clean up dummy file
    if (fs.existsSync(dummyFilePath)) fs.unlinkSync(dummyFilePath);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('draftId');
    expect(res.body.data.article.titulo).toBe('Mocked Title');

    // Save draftId for the next test
    createdDraftId = res.body.data.draftId;
  });

  it('4. Should approve the generated draft (status only; enqueue via /campaigns/launch)', async () => {
    const res = await request(app)
      .post(`/api/drafts/${createdDraftId}/approve`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ includeImage: false });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('APPROVED');
    // Approve no longer enqueues BullMQ — campaigns/launch does.
    expect(broadcastQueue.add).not.toHaveBeenCalled();
  });
});
