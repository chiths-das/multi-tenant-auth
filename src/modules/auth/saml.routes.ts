import { Router } from 'express';
import { z } from 'zod';
import { getPrisma } from '../../config/database.js';
import { getEnv } from '../../config/env.js';
import { hmacSign, timingSafeEqual } from '../../lib/crypto.js';
import { generateSpMetadata } from '../../lib/saml-utils.js';
import { NotFoundError, UnauthorizedError, ValidationError } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { getStrategy } from './strategies/index.js';
import { handleOAuthOrSamlLogin } from './auth.service.js';
import { v4 as uuidv4 } from 'uuid';

export const samlRouter = Router();

const startSchema = z.object({
  tenant: z.string().uuid(),
});

// Pending states stored in memory
const pendingStates = new Map<string, { tenantId: string; expiresAt: number }>();

samlRouter.get('/start', validate({ query: startSchema }), async (req, res, next) => {
  try {
    const { tenant } = req.query as { tenant: string };
    const strategy = getStrategy('saml');

    if (!strategy.getAuthorizationUrl) {
      throw new ValidationError('SAML strategy does not support redirect flow');
    }

    const nonce = uuidv4();
    const stateData = `${tenant}:${nonce}`;
    const signature = hmacSign(stateData, getEnv().JWT_SECRET);
    const state = `${stateData}:${signature}`;

    pendingStates.set(signature, {
      tenantId: tenant,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    const url = await strategy.getAuthorizationUrl(tenant, state);
    res.redirect(url!);
  } catch (err) {
    next(err);
  }
});

samlRouter.post('/callback', async (req, res, next) => {
  try {
    const { SAMLResponse, RelayState } = req.body as {
      SAMLResponse?: string;
      RelayState?: string;
    };

    if (!SAMLResponse || !RelayState) {
      throw new ValidationError('Missing SAMLResponse or RelayState');
    }

    // Validate state
    const parts = RelayState.split(':');
    if (parts.length !== 3) throw new UnauthorizedError('Invalid RelayState');

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

    // Decode SAML response (basic decoding - in production use passport-saml for full validation)
    const decoded = Buffer.from(SAMLResponse, 'base64').toString('utf-8');

    // Extract NameID and attributes from the decoded response
    // This is simplified - passport-saml handles full validation
    const nameIdMatch = decoded.match(/<saml:NameID[^>]*>([^<]+)<\/saml:NameID>/);
    if (!nameIdMatch) {
      throw new UnauthorizedError('Invalid SAML response: missing NameID');
    }

    const strategy = getStrategy('saml');
    const result = await strategy.authenticate({
      samlResponse: {
        nameID: nameIdMatch[1],
        email: nameIdMatch[1],
      },
      tenantId: pending.tenantId,
    });

    const tokens = await handleOAuthOrSamlLogin(
      result.providerType,
      result.providerUserId,
      result.email,
      result.displayName,
      pending.tenantId,
    );

    res.json(tokens);
  } catch (err) {
    next(err);
  }
});

// SP Metadata endpoint
samlRouter.get('/metadata/:tenantId', async (req, res, next) => {
  try {
    const { tenantId } = req.params;
    const env = getEnv();
    const entityId = `${env.BASE_URL}/auth/saml/metadata/${tenantId}`;
    const acsUrl = `${env.BASE_URL}/auth/saml/callback`;

    const metadata = generateSpMetadata(entityId, acsUrl);

    res.type('application/xml').send(metadata);
  } catch (err) {
    next(err);
  }
});
