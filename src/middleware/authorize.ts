import type { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../lib/errors.js';

/**
 * Middleware that checks if the authenticated user has any of the required permissions.
 */
export function authorize(...requiredPermissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.permissions) {
      throw new ForbiddenError('No permissions found');
    }

    const hasPermission = requiredPermissions.some((perm) =>
      req.permissions!.includes(perm),
    );

    if (!hasPermission) {
      throw new ForbiddenError(`Required permissions: ${requiredPermissions.join(', ')}`);
    }

    next();
  };
}
