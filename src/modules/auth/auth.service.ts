import { getPrisma } from '../../config/database.js';
import { hashPassword } from '../../lib/crypto.js';
import { ConflictError, NotFoundError, UnauthorizedError } from '../../lib/errors.js';
import {
  issueTokenPair,
  rotateRefreshToken,
  revokeRefreshTokenFamily,
  revokeAllUserTokens,
  type TokenPair,
} from '../tokens/token.service.js';
import { getStrategy } from './strategies/index.js';
import { resolvePermissions } from '../rbac/rbac.service.js';

interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
  tenantId: string;
}

interface LoginInput {
  email: string;
  password: string;
  tenantId: string;
}

interface LoginStep1Input {
  email: string;
  password: string;
}

interface LoginStep1Result {
  userId: string;
  email: string;
  displayName: string;
  tenants: Array<{
    id: string;
    name: string;
    slug: string;
    role: string;
    status: string;
  }>;
}

interface LoginSelectInput {
  userId: string;
  tenantId: string;
}

export async function register(input: RegisterInput): Promise<TokenPair> {
  const prisma = getPrisma();
  const { email, password, displayName, tenantId } = input;

  // Check tenant exists
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new NotFoundError('Tenant not found');

  // Check user doesn't already exist
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    // Check if already a member of this tenant
    const existingMembership = await prisma.tenantMembership.findUnique({
      where: { userId_tenantId: { userId: existingUser.id, tenantId } },
    });
    if (existingMembership) throw new ConflictError('User is already a member of this tenant');
  }

  const passwordHash = await hashPassword(password);

  // Get default member role for tenant
  const defaultRole = await prisma.role.findFirst({
    where: { tenantId, name: 'member', isSystem: true },
  });
  if (!defaultRole) throw new Error('Default member role not found for tenant');

  let userId: string;

  if (existingUser) {
    // User exists but not in this tenant - add membership
    userId = existingUser.id;
    await prisma.tenantMembership.create({
      data: { userId, tenantId, roleId: defaultRole.id },
    });
  } else {
    // Create new user + membership
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName,
        memberships: {
          create: { tenantId, roleId: defaultRole.id },
        },
      },
    });
    userId = user.id;
  }

  const permissions = await resolvePermissions(defaultRole.id);
  return issueTokenPair(userId, tenantId, defaultRole.name, permissions);
}

export async function login(input: LoginInput): Promise<TokenPair> {
  const prisma = getPrisma();
  const { email, password, tenantId } = input;

  const strategy = getStrategy('local');
  const result = await strategy.authenticate({ email, password });

  // Verify user is a member of the tenant
  const membership = await prisma.tenantMembership.findUnique({
    where: { userId_tenantId: { userId: result.userId, tenantId } },
    include: { role: true },
  });

  if (!membership || membership.status !== 'ACTIVE') {
    throw new UnauthorizedError('User is not an active member of this tenant');
  }

  const permissions = await resolvePermissions(membership.roleId);
  return issueTokenPair(result.userId, tenantId, membership.role.name, permissions);
}

/**
 * Step 1: Authenticate with email + password. Returns the user's identity
 * and all tenant memberships so the client can pick which tenant to log into.
 */
export async function loginStep1(input: LoginStep1Input): Promise<LoginStep1Result> {
  const prisma = getPrisma();
  const { email, password } = input;

  const strategy = getStrategy('local');
  const result = await strategy.authenticate({ email, password });

  const memberships = await prisma.tenantMembership.findMany({
    where: { userId: result.userId },
    include: {
      tenant: { select: { id: true, name: true, slug: true } },
      role: { select: { name: true } },
    },
  });

  if (memberships.length === 0) {
    throw new UnauthorizedError('User is not a member of any tenant');
  }

  return {
    userId: result.userId,
    email: result.email,
    displayName: result.displayName,
    tenants: memberships.map((m) => ({
      id: m.tenant.id,
      name: m.tenant.name,
      slug: m.tenant.slug,
      role: m.role.name,
      status: m.status,
    })),
  };
}

/**
 * Step 2: Select a tenant and get tokens. If the user only belongs to one
 * tenant, the client can call this immediately after step 1.
 */
export async function loginSelect(input: LoginSelectInput): Promise<TokenPair> {
  const prisma = getPrisma();
  const { userId, tenantId } = input;

  const membership = await prisma.tenantMembership.findUnique({
    where: { userId_tenantId: { userId, tenantId } },
    include: { role: true },
  });

  if (!membership || membership.status !== 'ACTIVE') {
    throw new UnauthorizedError('User is not an active member of this tenant');
  }

  const permissions = await resolvePermissions(membership.roleId);
  return issueTokenPair(userId, tenantId, membership.role.name, permissions);
}

export async function refresh(rawRefreshToken: string): Promise<TokenPair> {
  const prisma = getPrisma();
  const { userId, tenantId, newRawToken } = await rotateRefreshToken(rawRefreshToken);

  // Resolve current role + permissions
  const membership = await prisma.tenantMembership.findUnique({
    where: { userId_tenantId: { userId, tenantId } },
    include: { role: true },
  });

  if (!membership || membership.status !== 'ACTIVE') {
    throw new UnauthorizedError('User is not an active member of this tenant');
  }

  const permissions = await resolvePermissions(membership.roleId);
  const { issueAccessToken } = await import('../tokens/token.service.js');
  const accessToken = issueAccessToken({ sub: userId, tid: tenantId, role: membership.role.name, permissions });

  return { accessToken, refreshToken: newRawToken };
}

export async function logout(rawRefreshToken: string): Promise<void> {
  const { sha256 } = await import('../../lib/crypto.js');
  const prisma = getPrisma();
  const tokenHash = sha256(rawRefreshToken);

  const token = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (token) {
    await revokeRefreshTokenFamily(token.familyId);
  }
}

export async function handleOAuthOrSamlLogin(
  providerType: string,
  providerUserId: string,
  email: string,
  displayName: string,
  tenantId: string,
  accessTokenFromProvider?: string,
  refreshTokenFromProvider?: string,
): Promise<TokenPair> {
  const prisma = getPrisma();

  // Find or create linked account
  let linkedAccount = await prisma.linkedAccount.findUnique({
    where: { providerType_providerUserId: { providerType, providerUserId } },
    include: { user: true },
  });

  let userId: string;

  if (linkedAccount) {
    userId = linkedAccount.userId;
    // Update tokens if provided
    if (accessTokenFromProvider || refreshTokenFromProvider) {
      await prisma.linkedAccount.update({
        where: { id: linkedAccount.id },
        data: {
          ...(accessTokenFromProvider && { accessToken: accessTokenFromProvider }),
          ...(refreshTokenFromProvider && { refreshToken: refreshTokenFromProvider }),
        },
      });
    }
  } else {
    // Check if user exists by email
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: { email, displayName },
      });
    }
    userId = user.id;

    await prisma.linkedAccount.create({
      data: {
        userId,
        providerType,
        providerUserId,
        accessToken: accessTokenFromProvider,
        refreshToken: refreshTokenFromProvider,
      },
    });
  }

  // Ensure membership in tenant
  let membership = await prisma.tenantMembership.findUnique({
    where: { userId_tenantId: { userId, tenantId } },
    include: { role: true },
  });

  if (!membership) {
    const defaultRole = await prisma.role.findFirst({
      where: { tenantId, name: 'member', isSystem: true },
    });
    if (!defaultRole) throw new Error('Default member role not found for tenant');

    membership = await prisma.tenantMembership.create({
      data: { userId, tenantId, roleId: defaultRole.id },
      include: { role: true },
    });
  }

  if (membership.status !== 'ACTIVE') {
    throw new UnauthorizedError('User membership is not active in this tenant');
  }

  const permissions = await resolvePermissions(membership.roleId);
  return issueTokenPair(userId, tenantId, membership.role.name, permissions);
}
