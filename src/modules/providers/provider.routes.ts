import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { tenantFromParams } from '../../middleware/tenantContext.js';
import { validate } from '../../middleware/validate.js';
import * as providerService from './provider.service.js';

export const providerRouter = Router();

const createOAuthSchema = z.object({
  type: z.enum(['GOOGLE', 'MICROSOFT']),
  enabled: z.boolean().optional(),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  scopes: z.string().optional(),
  authUrl: z.string().url().optional(),
  tokenUrl: z.string().url().optional(),
  userInfoUrl: z.string().url().optional(),
});

const updateOAuthSchema = z.object({
  enabled: z.boolean().optional(),
  clientId: z.string().min(1).optional(),
  clientSecret: z.string().min(1).optional(),
  scopes: z.string().optional(),
  authUrl: z.string().url().nullable().optional(),
  tokenUrl: z.string().url().nullable().optional(),
  userInfoUrl: z.string().url().nullable().optional(),
});

const createSamlSchema = z.object({
  enabled: z.boolean().optional(),
  entityId: z.string().min(1),
  ssoUrl: z.string().url(),
  certificate: z.string().optional(),
  certificateFingerprint: z.string().optional(),
  signatureAlgorithm: z.string().optional(),
  digestAlgorithm: z.string().optional(),
  metadataXml: z.string().optional(),
});

const updateSamlSchema = z.object({
  enabled: z.boolean().optional(),
  entityId: z.string().min(1).optional(),
  ssoUrl: z.string().url().optional(),
  certificate: z.string().nullable().optional(),
  certificateFingerprint: z.string().nullable().optional(),
  signatureAlgorithm: z.string().optional(),
  digestAlgorithm: z.string().optional(),
  metadataXml: z.string().nullable().optional(),
});

// List providers
providerRouter.get(
  '/:tenantId/providers',
  authenticate,
  tenantFromParams(),
  authorize('providers:read'),
  async (req, res, next) => {
    try {
      const providers = await providerService.getProviders(req.params.tenantId as string);
      res.json(providers);
    } catch (err) {
      next(err);
    }
  },
);

// Get provider
providerRouter.get(
  '/:tenantId/providers/:providerId',
  authenticate,
  tenantFromParams(),
  authorize('providers:read'),
  async (req, res, next) => {
    try {
      const provider = await providerService.getProvider(req.params.tenantId as string, req.params.providerId as string);
      res.json(provider);
    } catch (err) {
      next(err);
    }
  },
);

// Create OAuth provider
providerRouter.post(
  '/:tenantId/providers/oauth',
  authenticate,
  tenantFromParams(),
  authorize('providers:manage'),
  validate({ body: createOAuthSchema }),
  async (req, res, next) => {
    try {
      const provider = await providerService.createOAuthProvider(req.params.tenantId as string, req.body);
      res.status(201).json(provider);
    } catch (err) {
      next(err);
    }
  },
);

// Update OAuth provider
providerRouter.patch(
  '/:tenantId/providers/:providerId/oauth',
  authenticate,
  tenantFromParams(),
  authorize('providers:manage'),
  validate({ body: updateOAuthSchema }),
  async (req, res, next) => {
    try {
      const provider = await providerService.updateOAuthProvider(
        req.params.tenantId as string,
        req.params.providerId as string,
        req.body,
      );
      res.json(provider);
    } catch (err) {
      next(err);
    }
  },
);

// Create SAML provider
providerRouter.post(
  '/:tenantId/providers/saml',
  authenticate,
  tenantFromParams(),
  authorize('providers:manage'),
  validate({ body: createSamlSchema }),
  async (req, res, next) => {
    try {
      const provider = await providerService.createSamlProvider(req.params.tenantId as string, req.body);
      res.status(201).json(provider);
    } catch (err) {
      next(err);
    }
  },
);

// Update SAML provider
providerRouter.patch(
  '/:tenantId/providers/:providerId/saml',
  authenticate,
  tenantFromParams(),
  authorize('providers:manage'),
  validate({ body: updateSamlSchema }),
  async (req, res, next) => {
    try {
      const provider = await providerService.updateSamlProvider(
        req.params.tenantId as string,
        req.params.providerId as string,
        req.body,
      );
      res.json(provider);
    } catch (err) {
      next(err);
    }
  },
);

// Delete provider
providerRouter.delete(
  '/:tenantId/providers/:providerId',
  authenticate,
  tenantFromParams(),
  authorize('providers:manage'),
  async (req, res, next) => {
    try {
      await providerService.deleteProvider(req.params.tenantId as string, req.params.providerId as string);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);
