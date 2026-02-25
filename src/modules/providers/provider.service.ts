import { getPrisma } from '../../config/database.js';
import { encrypt, decrypt } from '../../lib/crypto.js';
import { ConflictError, NotFoundError } from '../../lib/errors.js';
import type { ProviderType } from '@prisma/client';

export async function getProviders(tenantId: string) {
  const prisma = getPrisma();
  const providers = await prisma.authProvider.findMany({
    where: { tenantId },
    include: { oauthProviderConfig: true, samlProviderConfig: true },
  });

  // Mask secrets
  return providers.map((p) => ({
    ...p,
    oauthProviderConfig: p.oauthProviderConfig
      ? { ...p.oauthProviderConfig, clientSecret: '••••••••' }
      : null,
  }));
}

export async function getProvider(tenantId: string, providerId: string) {
  const prisma = getPrisma();
  const provider = await prisma.authProvider.findFirst({
    where: { id: providerId, tenantId },
    include: { oauthProviderConfig: true, samlProviderConfig: true },
  });
  if (!provider) throw new NotFoundError('Provider not found');

  return {
    ...provider,
    oauthProviderConfig: provider.oauthProviderConfig
      ? { ...provider.oauthProviderConfig, clientSecret: '••••••••' }
      : null,
  };
}

interface CreateOAuthProviderInput {
  type: 'GOOGLE' | 'MICROSOFT';
  enabled?: boolean;
  clientId: string;
  clientSecret: string;
  scopes?: string;
  authUrl?: string;
  tokenUrl?: string;
  userInfoUrl?: string;
}

export async function createOAuthProvider(tenantId: string, input: CreateOAuthProviderInput) {
  const prisma = getPrisma();

  const existing = await prisma.authProvider.findUnique({
    where: { tenantId_type: { tenantId, type: input.type as ProviderType } },
  });
  if (existing) throw new ConflictError('Provider type already configured for this tenant');

  const encryptedSecret = encrypt(input.clientSecret);

  const provider = await prisma.authProvider.create({
    data: {
      tenantId,
      type: input.type as ProviderType,
      enabled: input.enabled ?? false,
      oauthProviderConfig: {
        create: {
          tenantId,
          clientId: input.clientId,
          clientSecret: encryptedSecret,
          scopes: input.scopes || 'openid email profile',
          authUrl: input.authUrl,
          tokenUrl: input.tokenUrl,
          userInfoUrl: input.userInfoUrl,
        },
      },
    },
    include: { oauthProviderConfig: true },
  });

  return {
    ...provider,
    oauthProviderConfig: provider.oauthProviderConfig
      ? { ...provider.oauthProviderConfig, clientSecret: '••••••••' }
      : null,
  };
}

export async function updateOAuthProvider(
  tenantId: string,
  providerId: string,
  input: Partial<CreateOAuthProviderInput>,
) {
  const prisma = getPrisma();
  const provider = await prisma.authProvider.findFirst({
    where: { id: providerId, tenantId },
    include: { oauthProviderConfig: true },
  });
  if (!provider) throw new NotFoundError('Provider not found');

  const updateData: Record<string, unknown> = {};
  if (input.clientId) updateData.clientId = input.clientId;
  if (input.clientSecret) updateData.clientSecret = encrypt(input.clientSecret);
  if (input.scopes) updateData.scopes = input.scopes;
  if (input.authUrl !== undefined) updateData.authUrl = input.authUrl;
  if (input.tokenUrl !== undefined) updateData.tokenUrl = input.tokenUrl;
  if (input.userInfoUrl !== undefined) updateData.userInfoUrl = input.userInfoUrl;

  const updated = await prisma.authProvider.update({
    where: { id: providerId },
    data: {
      enabled: input.enabled ?? provider.enabled,
      oauthProviderConfig: provider.oauthProviderConfig
        ? { update: updateData }
        : undefined,
    },
    include: { oauthProviderConfig: true },
  });

  return {
    ...updated,
    oauthProviderConfig: updated.oauthProviderConfig
      ? { ...updated.oauthProviderConfig, clientSecret: '••••••••' }
      : null,
  };
}

export async function deleteProvider(tenantId: string, providerId: string) {
  const prisma = getPrisma();
  const provider = await prisma.authProvider.findFirst({
    where: { id: providerId, tenantId },
  });
  if (!provider) throw new NotFoundError('Provider not found');

  return prisma.authProvider.delete({ where: { id: providerId } });
}

interface CreateSamlProviderInput {
  enabled?: boolean;
  entityId: string;
  ssoUrl: string;
  certificate?: string;
  certificateFingerprint?: string;
  signatureAlgorithm?: string;
  digestAlgorithm?: string;
  metadataXml?: string;
}

export async function createSamlProvider(tenantId: string, input: CreateSamlProviderInput) {
  const prisma = getPrisma();

  const existing = await prisma.authProvider.findUnique({
    where: { tenantId_type: { tenantId, type: 'SAML' } },
  });
  if (existing) throw new ConflictError('SAML provider already configured for this tenant');

  return prisma.authProvider.create({
    data: {
      tenantId,
      type: 'SAML',
      enabled: input.enabled ?? false,
      samlProviderConfig: {
        create: {
          tenantId,
          entityId: input.entityId,
          ssoUrl: input.ssoUrl,
          certificate: input.certificate,
          certificateFingerprint: input.certificateFingerprint,
          signatureAlgorithm: input.signatureAlgorithm || 'sha256',
          digestAlgorithm: input.digestAlgorithm || 'sha256',
          metadataXml: input.metadataXml,
        },
      },
    },
    include: { samlProviderConfig: true },
  });
}

export async function updateSamlProvider(
  tenantId: string,
  providerId: string,
  input: Partial<CreateSamlProviderInput>,
) {
  const prisma = getPrisma();
  const provider = await prisma.authProvider.findFirst({
    where: { id: providerId, tenantId },
    include: { samlProviderConfig: true },
  });
  if (!provider) throw new NotFoundError('Provider not found');

  const updateData: Record<string, unknown> = {};
  if (input.entityId) updateData.entityId = input.entityId;
  if (input.ssoUrl) updateData.ssoUrl = input.ssoUrl;
  if (input.certificate !== undefined) updateData.certificate = input.certificate;
  if (input.certificateFingerprint !== undefined) updateData.certificateFingerprint = input.certificateFingerprint;
  if (input.signatureAlgorithm) updateData.signatureAlgorithm = input.signatureAlgorithm;
  if (input.digestAlgorithm) updateData.digestAlgorithm = input.digestAlgorithm;
  if (input.metadataXml !== undefined) updateData.metadataXml = input.metadataXml;

  return prisma.authProvider.update({
    where: { id: providerId },
    data: {
      enabled: input.enabled ?? provider.enabled,
      samlProviderConfig: provider.samlProviderConfig
        ? { update: updateData }
        : undefined,
    },
    include: { samlProviderConfig: true },
  });
}
