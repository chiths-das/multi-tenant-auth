import { getPrisma } from '../../config/database.js';
import { ConflictError, NotFoundError, ForbiddenError } from '../../lib/errors.js';
import { createDefaultRoles } from '../rbac/rbac.service.js';

export async function createTenant(name: string, slug: string, domain?: string, creatorUserId?: string) {
  const prisma = getPrisma();

  const existing = await prisma.tenant.findUnique({ where: { slug } });
  if (existing) throw new ConflictError('Tenant slug already exists');

  if (domain) {
    const domainExists = await prisma.tenant.findUnique({ where: { domain } });
    if (domainExists) throw new ConflictError('Domain already in use');
  }

  const tenant = await prisma.tenant.create({
    data: { name, slug, domain },
  });

  // Create default roles (admin + member)
  const { adminRole } = await createDefaultRoles(tenant.id);

  // If a creator user ID is provided, make them admin
  if (creatorUserId) {
    await prisma.tenantMembership.create({
      data: { userId: creatorUserId, tenantId: tenant.id, roleId: adminRole.id },
    });
  }

  return tenant;
}

export async function getTenant(tenantId: string) {
  const prisma = getPrisma();
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new NotFoundError('Tenant not found');
  return tenant;
}

export async function updateTenant(tenantId: string, data: { name?: string; slug?: string; domain?: string | null }) {
  const prisma = getPrisma();
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new NotFoundError('Tenant not found');

  if (data.slug && data.slug !== tenant.slug) {
    const existing = await prisma.tenant.findUnique({ where: { slug: data.slug } });
    if (existing) throw new ConflictError('Tenant slug already exists');
  }

  if (data.domain && data.domain !== tenant.domain) {
    const existing = await prisma.tenant.findUnique({ where: { domain: data.domain } });
    if (existing) throw new ConflictError('Domain already in use');
  }

  return prisma.tenant.update({ where: { id: tenantId }, data });
}

export async function deleteTenant(tenantId: string) {
  const prisma = getPrisma();
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new NotFoundError('Tenant not found');
  return prisma.tenant.delete({ where: { id: tenantId } });
}

export async function getMembers(tenantId: string) {
  const prisma = getPrisma();
  return prisma.tenantMembership.findMany({
    where: { tenantId },
    include: {
      user: { select: { id: true, email: true, displayName: true } },
      role: { select: { id: true, name: true } },
    },
  });
}

export async function addMember(tenantId: string, userId: string, roleId: string) {
  const prisma = getPrisma();

  // Verify role belongs to tenant
  const role = await prisma.role.findFirst({ where: { id: roleId, tenantId } });
  if (!role) throw new NotFoundError('Role not found in this tenant');

  const existing = await prisma.tenantMembership.findUnique({
    where: { userId_tenantId: { userId, tenantId } },
  });
  if (existing) throw new ConflictError('User is already a member of this tenant');

  return prisma.tenantMembership.create({
    data: { userId, tenantId, roleId },
    include: {
      user: { select: { id: true, email: true, displayName: true } },
      role: { select: { id: true, name: true } },
    },
  });
}

export async function updateMember(tenantId: string, userId: string, data: { roleId?: string; status?: 'ACTIVE' | 'INACTIVE' }) {
  const prisma = getPrisma();

  const membership = await prisma.tenantMembership.findUnique({
    where: { userId_tenantId: { userId, tenantId } },
  });
  if (!membership) throw new NotFoundError('Membership not found');

  if (data.roleId) {
    const role = await prisma.role.findFirst({ where: { id: data.roleId, tenantId } });
    if (!role) throw new NotFoundError('Role not found in this tenant');
  }

  return prisma.tenantMembership.update({
    where: { id: membership.id },
    data,
    include: {
      user: { select: { id: true, email: true, displayName: true } },
      role: { select: { id: true, name: true } },
    },
  });
}

export async function removeMember(tenantId: string, userId: string) {
  const prisma = getPrisma();

  const membership = await prisma.tenantMembership.findUnique({
    where: { userId_tenantId: { userId, tenantId } },
  });
  if (!membership) throw new NotFoundError('Membership not found');

  return prisma.tenantMembership.delete({ where: { id: membership.id } });
}
