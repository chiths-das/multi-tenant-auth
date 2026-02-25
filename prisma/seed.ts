import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PERMISSIONS = [
  { resource: 'users', action: 'read' },
  { resource: 'users', action: 'write' },
  { resource: 'users', action: 'delete' },
  { resource: 'tenants', action: 'read' },
  { resource: 'tenants', action: 'write' },
  { resource: 'tenants', action: 'delete' },
  { resource: 'members', action: 'read' },
  { resource: 'members', action: 'write' },
  { resource: 'members', action: 'delete' },
  { resource: 'roles', action: 'read' },
  { resource: 'roles', action: 'write' },
  { resource: 'roles', action: 'delete' },
  { resource: 'providers', action: 'read' },
  { resource: 'providers', action: 'write' },
  { resource: 'providers', action: 'delete' },
  { resource: 'providers', action: 'manage' },
];

async function main() {
  console.log('Seeding permissions...');
  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { resource_action: { resource: perm.resource, action: perm.action } },
      update: {},
      create: perm,
    });
  }
  console.log(`Seeded ${PERMISSIONS.length} permissions.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
