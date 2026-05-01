jest.mock('../../models/prismaClient', () => ({
  __esModule: true,
  default: {
    contact: {
      findUnique: jest.fn(),
      findFirst:  jest.fn(),
      findMany:   jest.fn(),
      count:      jest.fn(),
      create:     jest.fn(),
      update:     jest.fn(),
      delete:     jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

import prisma from '../../models/prismaClient';
import { ContactService } from '../ContactService';
import { AppError } from '../../utils/AppError';

const contactService = new ContactService();

const mockContact = {
  id: 1, userId: 10, phoneNumber: '5511999990001',
  name: 'João da Silva', active: true,
  createdAt: new Date(), updatedAt: new Date(),
};

describe('ContactService', () => {
  // ─────────────── create() ───────────────
  describe('create()', () => {
    it('should sanitize the number and create the contact', async () => {
      (prisma.contact.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.contact.create as jest.Mock).mockResolvedValue(mockContact);

      // Pass raw number with dashes — should be sanitized
      const result = await contactService.create({ userId: 10, phoneNumber: '55-11-99999-0001', name: 'João' });
      expect(result.phoneNumber).toBe('5511999990001');
    });

    it('should throw AppError 400 for invalid phone number format', async () => {
      await expect(
        contactService.create({ userId: 10, phoneNumber: 'ABC', name: 'Test' }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('should throw AppError 409 when phone already exists for that user', async () => {
      (prisma.contact.findUnique as jest.Mock).mockResolvedValue(mockContact);
      await expect(
        contactService.create({ userId: 10, phoneNumber: '5511999990001', name: 'Dup' }),
      ).rejects.toMatchObject({ statusCode: 409 });
    });
  });

  // ─────────────── findAllByUser() ───────────────
  describe('findAllByUser()', () => {
    beforeEach(() => {
      (prisma.$transaction as jest.Mock).mockResolvedValue([[mockContact], 1]);
    });

    it('should return paginated contacts with correct metadata', async () => {
      const result = await contactService.findAllByUser(10, { page: 1, limit: 20 });
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
      expect(result.page).toBe(1);
    });

    it('should filter by active when onlyActive flag is set', async () => {
      (prisma.$transaction as jest.Mock).mockResolvedValue([[{ ...mockContact, active: true }], 1]);
      const result = await contactService.findAllByUser(10, { page: 1, limit: 20 }, true);
      expect(result.data.every(c => c.active === true)).toBe(true);
    });
  });

  // ─────────────── findOneByUser() ───────────────
  describe('findOneByUser()', () => {
    it('should return the contact when it belongs to the user', async () => {
      (prisma.contact.findFirst as jest.Mock).mockResolvedValue(mockContact);
      const result = await contactService.findOneByUser(1, 10);
      expect(result.id).toBe(1);
    });

    it('should throw AppError 404 when not found or wrong user', async () => {
      (prisma.contact.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(contactService.findOneByUser(999, 10)).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  // ─────────────── update() ───────────────
  describe('update()', () => {
    it('should update and return contact when ownership is valid', async () => {
      const updated = { ...mockContact, active: false };
      (prisma.contact.findFirst as jest.Mock).mockResolvedValue(mockContact);
      (prisma.contact.update as jest.Mock).mockResolvedValue(updated);
      const result = await contactService.update(1, 10, { active: false });
      expect(result.active).toBe(false);
    });
  });

  // ─────────────── remove() ───────────────
  describe('remove()', () => {
    it('should delete the contact when ownership is valid', async () => {
      (prisma.contact.findFirst as jest.Mock).mockResolvedValue(mockContact);
      (prisma.contact.delete as jest.Mock).mockResolvedValue(mockContact);
      await expect(contactService.remove(1, 10)).resolves.toBeUndefined();
    });

    it('should throw AppError 404 if contact not found before deleting', async () => {
      (prisma.contact.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(contactService.remove(999, 10)).rejects.toMatchObject({ statusCode: 404 });
      expect(prisma.contact.delete).not.toHaveBeenCalled();
    });
  });

  // ─────────────── bulkCreate() ───────────────
  describe('bulkCreate()', () => {
    it('should import valid rows, skip duplicates, and collect errors', async () => {
      (prisma.contact.findUnique as jest.Mock)
        .mockResolvedValueOnce(null)          // row 1 → new
        .mockResolvedValueOnce(mockContact);  // row 2 → duplicate

      (prisma.contact.create as jest.Mock).mockResolvedValue(mockContact);

      const rows = [
        { name: 'João', phoneNumber: '5511999990001' },
        { name: 'Dup',  phoneNumber: '5511999990001' },
        { name: 'Bad',  phoneNumber: 'INVALID' },
      ];

      const result = await contactService.bulkCreate(10, rows);
      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].row).toBe(4); // header = row 1, data starts at row 2
    });
  });
});
