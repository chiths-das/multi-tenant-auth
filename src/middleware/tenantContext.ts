import type { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../lib/errors.js';

/**
 * Middleware that extracts tenant ID from the authenticated token
 * and makes it available on the request. Used after authenticate middleware.
 */
export function tenantContext(req: Request, _res: Response, next: NextFunction) {
  if (!req.tenantId) {
    throw new UnauthorizedError('Tenant context not available');
  }
  next();
}

/**
 * Middleware that extracts tenant ID from route params (for tenant-scoped routes).
 * Verifies the authenticated user's token tenant matches the requested tenant.
 */
export function tenantFromParams(paramName = 'tenantId') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const paramTenantId = req.params[paramName] as string;
    if (req.tenantId && req.tenantId !== paramTenantId) {
      throw new UnauthorizedError('Tenant mismatch');
    }
    req.tenantId = paramTenantId;
    next();
  };
}
