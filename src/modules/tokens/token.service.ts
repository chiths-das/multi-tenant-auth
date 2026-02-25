import jwt from 'jsonwebtoken';
import { PrismaClient, Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { getPrisma } from '../../config/database.js';
import { getEnv } from '../../config/env.js';
import { sha256, generateRandomToken } from '../../lib/crypto.js';
import { UnauthorizedError } from '../../lib/errors.js';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

export interface AccessTokenPayload {
  sub: string;
  tid: string;
  role: string;
  permissions: string[];
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export function issueAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, getEnv().JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    return jwt.verify(token, getEnv().JWT_SECRET) as AccessTokenPayload;
  } catch {
    throw new UnauthorizedError('Invalid or expired access token');
  }
}

export async function createRefreshToken(
  userId: string,
  tenantId: string,
  familyId?: string,
  tx?: Prisma.TransactionClient,
): Promise<string> {
  const db = tx || getPrisma();
  const rawToken = generateRandomToken();
  const tokenHash = sha256(rawToken);
  const fid = familyId || uuidv4();

  await db.refreshToken.create({
    data: {
      tokenHash,
      userId,
      tenantId,
      familyId: fid,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
    },
  });

  return rawToken;
}

export async function rotateRefreshToken(
  rawToken: string,
  tx?: Prisma.TransactionClient,
): Promise<{ userId: string; tenantId: string; familyId: string; newRawToken: string }> {
  const db = tx || getPrisma();
  const tokenHash = sha256(rawToken);

  const existing = await db.refreshToken.findUnique({ where: { tokenHash } });

  if (!existing) {
    throw new UnauthorizedError('Invalid refresh token');
  }

  // Check if token was already revoked (reuse detection)
  if (existing.revokedAt) {
    // Revoke entire family - possible token theft
    await db.refreshToken.updateMany({
      where: { familyId: existing.familyId },
      data: { revokedAt: new Date() },
    });
    throw new UnauthorizedError('Refresh token reuse detected, all tokens revoked');
  }

  if (existing.expiresAt < new Date()) {
    throw new UnauthorizedError('Refresh token expired');
  }

  // Create new token in same family
  const newRawToken = generateRandomToken();
  const newTokenHash = sha256(newRawToken);

  const newToken = await db.refreshToken.create({
    data: {
      tokenHash: newTokenHash,
      userId: existing.userId,
      tenantId: existing.tenantId,
      familyId: existing.familyId,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
    },
  });

  // Mark old token as revoked and replaced
  await db.refreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date(), replacedBy: newToken.id },
  });

  return {
    userId: existing.userId,
    tenantId: existing.tenantId,
    familyId: existing.familyId,
    newRawToken,
  };
}

export async function revokeRefreshTokenFamily(familyId: string, tx?: Prisma.TransactionClient): Promise<void> {
  const db = tx || getPrisma();
  await db.refreshToken.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllUserTokens(userId: string, tenantId: string, tx?: Prisma.TransactionClient): Promise<void> {
  const db = tx || getPrisma();
  await db.refreshToken.updateMany({
    where: { userId, tenantId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function issueTokenPair(
  userId: string,
  tenantId: string,
  role: string,
  permissions: string[],
  tx?: Prisma.TransactionClient,
): Promise<TokenPair> {
  const accessToken = issueAccessToken({ sub: userId, tid: tenantId, role, permissions });
  const refreshToken = await createRefreshToken(userId, tenantId, undefined, tx);
  return { accessToken, refreshToken };
}
