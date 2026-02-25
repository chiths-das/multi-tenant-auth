import { getPrisma } from '../../../config/database.js';
import { verifyPassword } from '../../../lib/crypto.js';
import { UnauthorizedError } from '../../../lib/errors.js';
import type { AuthStrategy, AuthResult } from './auth-strategy.js';

export class LocalStrategy implements AuthStrategy {
  readonly type = 'local';

  async authenticate(params: Record<string, unknown>): Promise<AuthResult> {
    const { email, password } = params as { email: string; password: string };
    const prisma = getPrisma();

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    return {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      providerType: 'local',
      providerUserId: user.id,
      isNewUser: false,
    };
  }
}
