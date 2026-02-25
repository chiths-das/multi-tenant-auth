import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { tenantFromParams } from '../../middleware/tenantContext.js';
import { validate } from '../../middleware/validate.js';
import * as rbacService from './rbac.service.js';

export const rbacRouter = Router();

const createRoleSchema = z.object({
  name: z.string().min(1).max(63),
});

const updateRoleSchema = z.object({
  name: z.string().min(1).max(63),
});

const setPermissionsSchema = z.object({
  permissionIds: z.array(z.string().uuid()),
});

// List all system permissions
rbacRouter.get(
  '/permissions',
  authenticate,
  async (_req, res, next) => {
    try {
      const permissions = await rbacService.getAllPermissions();
      res.json(permissions);
    } catch (err) {
      next(err);
    }
  },
);

// Tenant-scoped role routes
rbacRouter.get(
  '/:tenantId/roles',
  authenticate,
  tenantFromParams(),
  authorize('roles:read'),
  async (req, res, next) => {
    try {
      const roles = await rbacService.getRoles(req.params.tenantId as string);
      res.json(roles);
    } catch (err) {
      next(err);
    }
  },
);

rbacRouter.post(
  '/:tenantId/roles',
  authenticate,
  tenantFromParams(),
  authorize('roles:write'),
  validate({ body: createRoleSchema }),
  async (req, res, next) => {
    try {
      const role = await rbacService.createRole(req.params.tenantId as string, req.body.name);
      res.status(201).json(role);
    } catch (err) {
      next(err);
    }
  },
);

rbacRouter.get(
  '/:tenantId/roles/:roleId',
  authenticate,
  tenantFromParams(),
  authorize('roles:read'),
  async (req, res, next) => {
    try {
      const role = await rbacService.getRole(req.params.tenantId as string, req.params.roleId as string);
      res.json(role);
    } catch (err) {
      next(err);
    }
  },
);

rbacRouter.patch(
  '/:tenantId/roles/:roleId',
  authenticate,
  tenantFromParams(),
  authorize('roles:write'),
  validate({ body: updateRoleSchema }),
  async (req, res, next) => {
    try {
      const role = await rbacService.updateRole(req.params.tenantId as string, req.params.roleId as string, req.body.name);
      res.json(role);
    } catch (err) {
      next(err);
    }
  },
);

rbacRouter.delete(
  '/:tenantId/roles/:roleId',
  authenticate,
  tenantFromParams(),
  authorize('roles:delete'),
  async (req, res, next) => {
    try {
      await rbacService.deleteRole(req.params.tenantId as string, req.params.roleId as string);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

rbacRouter.put(
  '/:tenantId/roles/:roleId/permissions',
  authenticate,
  tenantFromParams(),
  authorize('roles:write'),
  validate({ body: setPermissionsSchema }),
  async (req, res, next) => {
    try {
      const role = await rbacService.setRolePermissions(
        req.params.tenantId as string,
        req.params.roleId as string,
        req.body.permissionIds,
      );
      res.json(role);
    } catch (err) {
      next(err);
    }
  },
);
