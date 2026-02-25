import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../modules/tokens/token.service.js';
import { UnauthorizedError } from '../lib/errors.js';

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid authorization header');
  }

  const token = authHeader.slice(7);
  const payload = verifyAccessToken(token);

  req.userId = payload.sub;
  req.tenantId = payload.tid;
  req.role = payload.role;
  req.permissions = payload.permissions;

  next();
}
