import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '@prisma/client';
import userService from './UserService';
import { AppError } from '../utils/AppError';

// ─────────────────────────────────────────────────────────────────────────────
// DTOs
// ─────────────────────────────────────────────────────────────────────────────

export interface RegisterDto {
  name: string;
  email: string;
  password: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthPayload {
  userId: number;
  email: string;
}

export interface AuthResult {
  token: string;
  user: Omit<User, 'passwordHash'>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const SALT_ROUNDS = 12;

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is not defined.');
  return secret;
}

function signToken(payload: AuthPayload): string {
  const expiresIn = (process.env.JWT_EXPIRES_IN || '7d') as `${number}${'s'|'m'|'h'|'d'|'w'|'y'}`;
  return jwt.sign(payload, getJwtSecret(), { expiresIn });
}

// ─────────────────────────────────────────────────────────────────────────────
// AuthService
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handles all authentication business logic:
 * password hashing, credential validation, and JWT lifecycle.
 */
export class AuthService {
  /**
   * Registers a new administrator user.
   * Hashes the plain-text password before persisting it.
   *
   * @param dto - Registration payload with name, email, and plain password.
   * @returns A signed JWT and the created user (without passwordHash).
   */
  async register(dto: RegisterDto): Promise<AuthResult> {
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const user = await userService.create({
      name:         dto.name,
      email:        dto.email,
      passwordHash,
    });

    const token = signToken({ userId: user.id, email: user.email });
    return { token, user };
  }

  /**
   * Authenticates a user by verifying their credentials.
   * Uses constant-time comparison (bcrypt.compare) to prevent timing attacks.
   *
   * @param dto - Login payload with email and plain password.
   * @returns A signed JWT and the authenticated user (without passwordHash).
   * @throws AppError (401) if credentials are invalid.
   */
  async login(dto: LoginDto): Promise<AuthResult> {
    const userRecord = await userService.findByEmail(dto.email);

    // Deliberate: use the same generic message for both "user not found" and
    // "wrong password" to prevent user enumeration attacks.
    if (!userRecord) {
      throw new AppError('Invalid credentials.', 401);
    }

    const passwordMatch = await bcrypt.compare(dto.password, userRecord.passwordHash);
    if (!passwordMatch) {
      throw new AppError('Invalid credentials.', 401);
    }

    const { passwordHash: _omitted, ...safeUser } = userRecord;
    const token = signToken({ userId: safeUser.id, email: safeUser.email });
    return { token, user: safeUser };
  }

  /**
   * Verifies a JWT and returns its decoded payload.
   *
   * @param token - The Bearer token string (without the "Bearer " prefix).
   * @returns The decoded AuthPayload.
   * @throws AppError (401) if the token is invalid or expired.
   */
  verifyToken(token: string): AuthPayload {
    try {
      return jwt.verify(token, getJwtSecret()) as AuthPayload;
    } catch {
      throw new AppError('Invalid or expired token.', 401);
    }
  }
}

export default new AuthService();
