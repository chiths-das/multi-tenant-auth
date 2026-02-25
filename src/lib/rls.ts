import { PrismaClient, Prisma } from '@prisma/client';

/**
 * Executes a callback within a Prisma transaction that sets the RLS tenant context.
 * All queries inside the callback will be filtered by the tenant_id RLS policy.
 */
export async function withTenantContext<T>(
  prisma: PrismaClient,
  tenantId: string,
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL app.current_tenant_id = '${tenantId}'`,
    );
    return callback(tx);
  });
}

/**
 * SQL for creating RLS policies. Run as a migration.
 */
export const RLS_POLICY_SQL = `
-- Enable RLS on tenant-scoped tables
ALTER TABLE tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_provider_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE saml_provider_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY tenant_isolation ON tenant_memberships
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation ON roles
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation ON role_permissions
  USING (role_id IN (SELECT id FROM roles WHERE tenant_id::text = current_setting('app.current_tenant_id', true)));

CREATE POLICY tenant_isolation ON auth_providers
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation ON oauth_provider_configs
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation ON saml_provider_configs
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation ON refresh_tokens
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
`;
