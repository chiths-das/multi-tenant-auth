import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { tenantFromParams } from '../../middleware/tenantContext.js';
import { validate } from '../../middleware/validate.js';
import * as tenantService from './tenant.service.js';

export const tenantRouter = Router();

const createTenantSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(63).regex(/^[a-z0-9-]+$/),
  domain: z.string().optional(),
});

const updateTenantSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  slug: z.string().min(1).max(63).regex(/^[a-z0-9-]+$/).optional(),
  domain: z.string().nullable().optional(),
});

const addMemberSchema = z.object({
  userId: z.string().uuid(),
  roleId: z.string().uuid(),
});

const updateMemberSchema = z.object({
  roleId: z.string().uuid().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

// Create tenant (authenticated, no tenant context required)
tenantRouter.post(
  '/',
  authenticate,
  validate({ body: createTenantSchema }),
  async (req, res, next) => {
    try {
      const tenant = await tenantService.createTenant(req.body.name, req.body.slug, req.body.domain, req.userId);
      res.status(201).json(tenant);
    } catch (err) {
      next(err);
    }
  },
);

// Tenant-scoped routes
tenantRouter.get(
  '/:tenantId',
  authenticate,
  tenantFromParams(),
  authorize('tenants:read'),
  async (req, res, next) => {
    try {
      const tenant = await tenantService.getTenant(req.params.tenantId as string);
      res.json(tenant);
    } catch (err) {
      next(err);
    }
  },
);

tenantRouter.patch(
  '/:tenantId',
  authenticate,
  tenantFromParams(),
  authorize('tenants:write'),
  validate({ body: updateTenantSchema }),
  async (req, res, next) => {
    try {
      const tenant = await tenantService.updateTenant(req.params.tenantId as string, req.body);
      res.json(tenant);
    } catch (err) {
      next(err);
    }
  },
);

tenantRouter.delete(
  '/:tenantId',
  authenticate,
  tenantFromParams(),
  authorize('tenants:delete'),
  async (req, res, next) => {
    try {
      await tenantService.deleteTenant(req.params.tenantId as string);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

// Member management
tenantRouter.get(
  '/:tenantId/members',
  authenticate,
  tenantFromParams(),
  authorize('members:read'),
  async (req, res, next) => {
    try {
      const members = await tenantService.getMembers(req.params.tenantId as string);
      res.json(members);
    } catch (err) {
      next(err);
    }
  },
);

tenantRouter.post(
  '/:tenantId/members',
  authenticate,
  tenantFromParams(),
  authorize('members:write'),
  validate({ body: addMemberSchema }),
  async (req, res, next) => {
    try {
      const member = await tenantService.addMember(req.params.tenantId as string, req.body.userId, req.body.roleId);
      res.status(201).json(member);
    } catch (err) {
      next(err);
    }
  },
);

tenantRouter.patch(
  '/:tenantId/members/:userId',
  authenticate,
  tenantFromParams(),
  authorize('members:write'),
  validate({ body: updateMemberSchema }),
  async (req, res, next) => {
    try {
      const member = await tenantService.updateMember(req.params.tenantId as string, req.params.userId as string, req.body);
      res.json(member);
    } catch (err) {
      next(err);
    }
  },
);

tenantRouter.delete(
  '/:tenantId/members/:userId',
  authenticate,
  tenantFromParams(),
  authorize('members:delete'),
  async (req, res, next) => {
    try {
      await tenantService.removeMember(req.params.tenantId as string, req.params.userId as string);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);
