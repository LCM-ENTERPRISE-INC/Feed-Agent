import { Contact } from '@prisma/client';
import prisma from '../models/prismaClient';
import { AppError } from '../utils/AppError';
import { sanitizePhoneNumber } from '../utils/phoneUtils';

// ─────────────────────────────────────────────────────────────────────────────
// DTOs
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateContactDto {
  userId:      number;
  phoneNumber: string;
  name:        string;
}

export interface UpdateContactDto {
  name?:   string;
  active?: boolean;
}

export interface PaginationOptions {
  page:  number;
  limit: number;
}

export interface ContactListFilters {
  /** When true, only active; when false, only inactive; when undefined, all. */
  active?: boolean;
  /** Case-insensitive search on name or phoneNumber. */
  q?: string;
}

export interface PaginatedResult<T> {
  data:       T[];
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
}

export interface ContactStatsResult {
  total: number;
  active: number;
  inactive: number;
  activeRate: number;
  inactiveRate: number;
  monthlyGrowth: Array<{ name: string; year: number; month: number; count: number }>;
}

export interface BulkImportResult {
  imported: number;
  skipped:  number;
  errors:   Array<{ row: number; phoneNumber: string; reason: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// ContactService
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Data-access service for the Contact entity.
 * Enforces tenant isolation: every mutating method validates that the
 * contact belongs to the requesting userId before executing.
 */
export class ContactService {
  /**
   * Creates a new contact for a user.
   * Sanitizes the phone number to E.164 format before persisting.
   * Throws AppError (409) if the number is already registered for that user.
   *
   * @param dto - Payload containing userId, phoneNumber (raw), and name.
   * @returns The newly created Contact record.
   */
  async create(dto: CreateContactDto): Promise<Contact> {
    let sanitized: string;
    try {
      sanitized = sanitizePhoneNumber(dto.phoneNumber);
    } catch (e: unknown) {
      throw new AppError((e as Error).message, 400);
    }

    const existing = await prisma.contact.findUnique({
      where: {
        userId_phoneNumber: { userId: dto.userId, phoneNumber: sanitized },
      },
    });

    if (existing) {
      throw new AppError('This phone number is already registered for this account.', 409);
    }

    return prisma.contact.create({
      data: { userId: dto.userId, phoneNumber: sanitized, name: dto.name },
    });
  }

  /**
   * Returns a paginated list of contacts owned by a specific user.
   *
   * @param userId     - The owner user's ID.
   * @param pagination - Page number (1-indexed) and items per page.
   * @param filtersOrOnlyActive - Legacy boolean `onlyActive` or structured filters.
   */
  async findAllByUser(
    userId:     number,
    pagination: PaginationOptions = { page: 1, limit: 20 },
    filtersOrOnlyActive: boolean | ContactListFilters = {},
  ): Promise<PaginatedResult<Contact>> {
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    const filters: ContactListFilters =
      typeof filtersOrOnlyActive === 'boolean'
        ? (filtersOrOnlyActive ? { active: true } : {})
        : filtersOrOnlyActive;

    const where: {
      userId: number;
      active?: boolean;
      OR?: Array<{ name?: { contains: string; mode: 'insensitive' }; phoneNumber?: { contains: string } }>;
    } = { userId };

    if (typeof filters.active === 'boolean') {
      where.active = filters.active;
    }

    const q = filters.q?.trim();
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { phoneNumber: { contains: q.replace(/\D/g, '') || q } },
      ];
    }

    const [data, total] = await prisma.$transaction([
      prisma.contact.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.contact.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit) || 1),
    };
  }

  /**
   * Aggregate contact totals for the authenticated user (not limited by list page size).
   */
  async getStats(userId: number): Promise<ContactStatsResult> {
    const [total, active, inactive] = await Promise.all([
      prisma.contact.count({ where: { userId } }),
      prisma.contact.count({ where: { userId, active: true } }),
      prisma.contact.count({ where: { userId, active: false } }),
    ]);

    const now = new Date();
    const months: ContactStatsResult['monthlyGrowth'] = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const year = d.getUTCFullYear();
      const month = d.getUTCMonth() + 1;
      const start = new Date(Date.UTC(year, month - 1, 1));
      const end = new Date(Date.UTC(year, month, 1));
      const count = await prisma.contact.count({
        where: { userId, createdAt: { gte: start, lt: end } },
      });
      const label = start.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' });
      months.push({
        name: label.replace('.', ''),
        year,
        month,
        count,
      });
    }

    const activeRate = total > 0 ? Math.round((active / total) * 100) : 0;
    const inactiveRate = total > 0 ? Math.round((inactive / total) * 100) : 0;

    return {
      total,
      active,
      inactive,
      activeRate,
      inactiveRate,
      monthlyGrowth: months,
    };
  }

  /**
   * Finds a single contact by ID, validating ownership.
   * Throws AppError (404) if not found or if userId does not match.
   */
  async findOneByUser(id: number, userId: number): Promise<Contact> {
    const contact = await prisma.contact.findFirst({ where: { id, userId } });
    if (!contact) throw new AppError('Contact not found.', 404);
    return contact;
  }

  /**
   * Updates a contact's name and/or active status.
   * Validates ownership before updating.
   */
  async update(id: number, userId: number, dto: UpdateContactDto): Promise<Contact> {
    await this.findOneByUser(id, userId);
    return prisma.contact.update({ where: { id }, data: dto });
  }

  /**
   * Deletes a contact by ID.
   * Validates ownership before deleting.
   */
  async remove(id: number, userId: number): Promise<void> {
    await this.findOneByUser(id, userId);
    await prisma.contact.delete({ where: { id } });
  }

  /**
   * Imports multiple contacts in bulk from a parsed CSV payload.
   * Skips duplicates silently; collects validation errors per row without
   * aborting the entire import (partial success pattern).
   *
   * @param userId - The owner user's ID.
   * @param rows   - Array of { name, phoneNumber } objects from the CSV parser.
   * @returns Summary of imported, skipped, and errored rows.
   */
  async bulkCreate(
    userId: number,
    rows:   Array<{ name: string; phoneNumber: string }>,
  ): Promise<BulkImportResult> {
    const result: BulkImportResult = { imported: 0, skipped: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      let sanitized: string;

      // Validate phone number format
      try {
        sanitized = sanitizePhoneNumber(row.phoneNumber);
      } catch (e: unknown) {
        result.errors.push({ row: i + 2, phoneNumber: row.phoneNumber, reason: (e as Error).message });
        continue;
      }

      // Check for duplicates silently
      const existing = await prisma.contact.findUnique({
        where: { userId_phoneNumber: { userId, phoneNumber: sanitized } },
      });

      if (existing) {
        result.skipped++;
        continue;
      }

      await prisma.contact.create({
        data: { userId, phoneNumber: sanitized, name: row.name },
      });
      result.imported++;
    }

    return result;
  }
}

export default new ContactService();
