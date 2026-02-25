import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { getEnv } from '../../config/env.js';
import { hmacSign, timingSafeEqual } from '../../lib/crypto.js';
import { UnauthorizedError, ValidationError } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { getStrategy } from './strategies/index.js';
import { handleOAuthOrSamlLogin } from './auth.service.js';

export const oauthRouter = Router();

const startSchema = z.object({
  provider: z.enum(['google', 'microsoft']),
  tenant: z.string().uuid(),
});

// Pending states stored in memory (in production, use Redis)
const pendingStates = new Map<string, { tenantId: string; provider: string; expiresAt: number }>();

oauthRouter.get('/start', validate({ query: startSchema }), async (req, res, next) => {
  try {
    const { provider, tenant } = req.query as { provider: string; tenant: string };
    const strategy = getStrategy(provider);

    if (!strategy.getAuthorizationUrl) {
      throw new ValidationError('Provider does not support OAuth flow');
    }

    const nonce = uuidv4();
    const stateData = `${tenant}:${nonce}`;
    const signature = hmacSign(stateData, getEnv().JWT_SECRET);
    const state = `${stateData}:${signature}`;

    pendingStates.set(signature, {
      tenantId: tenant,
      provider,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    });

    const url = await strategy.getAuthorizationUrl(tenant, state);
    res.redirect(url!);
  } catch (err) {
    next(err);
  }
});

oauthRouter.get('/callback', async (req, res, next) => {
  try {
    const { code, state, error } = req.query as { code?: string; state?: string; error?: string };

    if (error) {
      throw new UnauthorizedError(`OAuth error: ${error}`);
    }

    if (!code || !state) {
      throw new ValidationError('Missing code or state parameter');
    }

    // Validate state
    const parts = (state as string).split(':');
    if (parts.length !== 3) throw new UnauthorizedError('Invalid state');

    const [tenantId, nonce, signature] = parts;
    const expectedSignature = hmacSign(`${tenantId}:${nonce}`, getEnv().JWT_SECRET);

    if (!timingSafeEqual(signature, expectedSignature)) {
      throw new UnauthorizedError('Invalid state signature');
    }

    const pending = pendingStates.get(signature);
    if (!pending || pending.expiresAt < Date.now()) {
      pendingStates.delete(signature);
      throw new UnauthorizedError('State expired or not found');
    }

    pendingStates.delete(signature);

    const strategy = getStrategy(pending.provider);
    const result = await strategy.authenticate({ code, tenantId: pending.tenantId });

    const tokens = await handleOAuthOrSamlLogin(
      result.providerType,
      result.providerUserId,
      result.email,
      result.displayName,
      pending.tenantId,
    );

    // Return tokens as JSON (in production, redirect to frontend with tokens)
    res.json(tokens);
  } catch (err) {
    next(err);
  }
});
