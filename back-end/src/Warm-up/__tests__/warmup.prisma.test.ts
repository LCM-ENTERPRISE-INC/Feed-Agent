import { PrismaClient } from '@prisma/client';

describe('Prisma Schema - Warmup Entities', () => {
  it('should have WarmupProfile model generated in PrismaClient', () => {
    // Apenas checagem de tipos estáticos e propriedades, garantindo que o Prisma Generate ocorreu.
    const prisma = new PrismaClient();
    expect(prisma.warmupProfile).toBeDefined();
  });

  it('should have WarmupStatusHistory model generated in PrismaClient', () => {
    const prisma = new PrismaClient();
    expect(prisma.warmupStatusHistory).toBeDefined();
  });
});
