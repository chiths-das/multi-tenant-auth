import { getPrisma } from '../../config/database.js';
import { ConflictError, NotFoundError, ForbiddenError } from '../../lib/errors.js';

export async function resolvePermissions(roleId: string): Promise<string[]> {
  const prisma = getPrisma();
  const rolePerms = await prisma.rolePermission.findMany({
    where: { roleId },
    include: { permission: true },
  });
  return rolePerms.map((rp) => `${rp.permission.resource}:${rp.permission.action}`);
}

export async function createRole(tenantId: string, name: string, isSystem = false) {
  const prisma = getPrisma();
  return prisma.role.create({
    data: { tenantId, name, isSystem },
  });
}

export async function getRoles(tenantId: string) {
  const prisma = getPrisma();
  return prisma.role.findMany({
    where: { tenantId },
    include: { rolePermissions: { include: { permission: true } } },
  });
}

export async function getRole(tenantId: string, roleId: string) {
  const prisma = getPrisma();
  const role = await prisma.role.findFirst({
    where: { id: roleId, tenantId },
    include: { rolePermissions: { include: { permission: true } } },
  });
  if (!role) throw new NotFoundError('Role not found');
  return role;
}

export async function updateRole(tenantId: string, roleId: string, name: string) {
  const prisma = getPrisma();
  const role = await prisma.role.findFirst({ where: { id: roleId, tenantId } });
  if (!role) throw new NotFoundError('Role not found');
  if (role.isSystem) throw new ForbiddenError('Cannot rename system roles');
  return prisma.role.update({ where: { id: roleId }, data: { name } });
}

export async function deleteRole(tenantId: string, roleId: string) {
  const prisma = getPrisma();
  const role = await prisma.role.findFirst({ where: { id: roleId, tenantId } });
  if (!role) throw new NotFoundError('Role not found');
  if (role.isSystem) throw new ForbiddenError('Cannot delete system roles');

  // Check no members are assigned
  const memberCount = await prisma.tenantMembership.count({ where: { roleId } });
  if (memberCount > 0) throw new ConflictError('Cannot delete role with active members');

  return prisma.role.delete({ where: { id: roleId } });
}

export async function setRolePermissions(tenantId: string, roleId: string, permissionIds: string[]) {
  const prisma = getPrisma();
  const role = await prisma.role.findFirst({ where: { id: roleId, tenantId } });
  if (!role) throw new NotFoundError('Role not found');

  // Verify all permission IDs are valid
  const permissions = await prisma.permission.findMany({
    where: { id: { in: permissionIds } },
  });
  if (permissions.length !== permissionIds.length) {
    throw new NotFoundError('One or more permission IDs are invalid');
  }

  // Replace all role permissions
  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId } }),
    ...permissionIds.map((permissionId) =>
      prisma.rolePermission.create({ data: { roleId, permissionId } }),
    ),
  ]);

  return getRole(tenantId, roleId);
}

export async function getAllPermissions() {
  const prisma = getPrisma();
  return prisma.permission.findMany({ orderBy: [{ resource: 'asc' }, { action: 'asc' }] });
}

export async function createDefaultRoles(tenantId: string) {
  const prisma = getPrisma();

  // Get all permissions
  const allPermissions = await prisma.permission.findMany();
  const readPermissions = allPermissions.filter((p) => p.action === 'read');

  // Create admin role with all permissions
  const adminRole = await prisma.role.create({
    data: { tenantId, name: 'admin', isSystem: true },
  });

  // Create member role with read permissions
  const memberRole = await prisma.role.create({
    data: { tenantId, name: 'member', isSystem: true },
  });

  // Assign permissions
  await prisma.rolePermission.createMany({
    data: allPermissions.map((p) => ({ roleId: adminRole.id, permissionId: p.id })),
  });

  await prisma.rolePermission.createMany({
    data: readPermissions.map((p) => ({ roleId: memberRole.id, permissionId: p.id })),
  });

  return { adminRole, memberRole };
}
