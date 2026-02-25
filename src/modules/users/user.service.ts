import { getPrisma } from '../../config/database.js';
import { hashPassword, verifyPassword } from '../../lib/crypto.js';
import { NotFoundError, UnauthorizedError, ValidationError } from '../../lib/errors.js';

export async function getProfile(userId: string) {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      displayName: true,
      createdAt: true,
      memberships: {
        select: {
          tenantId: true,
          status: true,
          role: { select: { name: true } },
          tenant: { select: { name: true, slug: true } },
        },
      },
    },
  });
  if (!user) throw new NotFoundError('User not found');
  return user;
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.passwordHash) throw new NotFoundError('User not found or no password set');

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) throw new UnauthorizedError('Current password is incorrect');

  if (newPassword.length < 8) throw new ValidationError('Password must be at least 8 characters');

  const newHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: newHash } });
}

export async function getLinkedAccounts(userId: string) {
  const prisma = getPrisma();
  return prisma.linkedAccount.findMany({
    where: { userId },
    select: {
      id: true,
      providerType: true,
      providerUserId: true,
      createdAt: true,
    },
  });
}
