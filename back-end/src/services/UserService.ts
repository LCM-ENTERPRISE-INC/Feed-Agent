import { User } from '@prisma/client';
import prisma from '../models/prismaClient';
import { AppError } from '../utils/AppError';

// ─────────────────────────────────────────────────────────────────────────────
// DTOs
// ─────────────────────────────────────────────────────────────────────────────

/** Data required to persist a new user. The passwordHash must be pre-hashed by AuthService. */
export interface CreateUserDto {
  name: string;
  email: string;
  /** Bcrypt hash of the user's plain-text password. Never store raw passwords. */
  passwordHash: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// UserService
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pure data-access service for the User entity.
 * Does NOT handle business logic such as hashing or token generation —
 * those concerns belong to AuthService.
 */
export class UserService {
  /**
   * Persists a new administrator user.
   * Throws AppError (409) if the e-mail is already registered.
   *
   * @param dto - Pre-validated user data (password must already be hashed).
   * @returns The newly created User record, with passwordHash omitted.
   */
  async create(dto: CreateUserDto): Promise<Omit<User, 'passwordHash'>> {
    const existing = await prisma.user.findUnique({ where: { email: dto.email } });

    if (existing) {
      throw new AppError('E-mail already registered.', 409);
    }

    const user = await prisma.user.create({
      data: {
        name:         dto.name,
        email:        dto.email,
        passwordHash: dto.passwordHash,
      },
    });

    const { passwordHash: _omitted, ...safeUser } = user;
    return safeUser;
  }

  /**
   * Finds a user by their e-mail, including the hashed password.
   * Intended exclusively for authentication flows.
   *
   * @param email - The e-mail address to look up.
   * @returns The full User record, or null if not found.
   */
  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email } });
  }

  /**
   * Finds a user by their primary key ID.
   * Throws AppError (404) if not found.
   *
   * @param id - The user's numeric primary key.
   * @returns The User record with passwordHash omitted.
   */
  async findById(id: number): Promise<Omit<User, 'passwordHash'>> {
    const user = await prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new AppError('User not found.', 404);
    }

    const { passwordHash: _omitted, ...safeUser } = user;
    return safeUser;
  }
}

export default new UserService();
