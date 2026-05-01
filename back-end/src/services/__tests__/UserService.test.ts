// Mock the entire Prisma client module so tests never touch the real database.
jest.mock('../../models/prismaClient', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}));

import prisma from '../../models/prismaClient';
import { UserService } from '../UserService';
import { AppError } from '../../utils/AppError';

const userService = new UserService();

const mockUser = {
  id: 1,
  name: 'Admin User',
  email: 'admin@feedagent.io',
  passwordHash: 'hashed_pw_xyz',
  createdAt: new Date(),
  updatedAt: new Date(),
  contacts: [],
};

describe('UserService', () => {
  // ───────────────────────────── create ─────────────────────────────
  describe('create()', () => {
    it('should create and return a user without passwordHash when email is unique', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);

      const dto = { name: mockUser.name, email: mockUser.email, passwordHash: mockUser.passwordHash };
      const result = await userService.create(dto);

      expect(result).not.toHaveProperty('passwordHash');
      expect(result.email).toBe(mockUser.email);
      expect(prisma.user.create).toHaveBeenCalledTimes(1);
    });

    it('should throw AppError 409 when email is already registered', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const dto = { name: mockUser.name, email: mockUser.email, passwordHash: mockUser.passwordHash };

      await expect(userService.create(dto)).rejects.toMatchObject({
        statusCode: 409,
        message: 'E-mail already registered.',
      });
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  // ───────────────────────────── findByEmail ─────────────────────────────
  describe('findByEmail()', () => {
    it('should return the full user record (including passwordHash) when found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await userService.findByEmail(mockUser.email);

      expect(result).toHaveProperty('passwordHash');
      expect(result?.email).toBe(mockUser.email);
    });

    it('should return null when the email does not exist', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await userService.findByEmail('ghost@mail.com');

      expect(result).toBeNull();
    });
  });

  // ───────────────────────────── findById ─────────────────────────────
  describe('findById()', () => {
    it('should return a user without passwordHash when found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await userService.findById(1);

      expect(result).not.toHaveProperty('passwordHash');
      expect(result.id).toBe(1);
    });

    it('should throw AppError 404 when user does not exist', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(userService.findById(999)).rejects.toMatchObject({
        statusCode: 404,
        message: 'User not found.',
      });
    });
  });
});
