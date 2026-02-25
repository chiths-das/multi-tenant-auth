import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';
import * as authService from './auth.service.js';
import { oauthRouter } from './oauth.routes.js';
import { samlRouter } from './saml.routes.js';

export const authRouter = Router();

authRouter.use('/oauth', oauthRouter);
authRouter.use('/saml', samlRouter);

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(255),
  tenantId: z.string().uuid(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  tenantId: z.string().uuid(),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const logoutSchema = z.object({
  refreshToken: z.string().min(1),
});

authRouter.post('/register', validate({ body: registerSchema }), async (req, res, next) => {
  try {
    const tokens = await authService.register(req.body);
    res.status(201).json(tokens);
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', validate({ body: loginSchema }), async (req, res, next) => {
  try {
    const tokens = await authService.login(req.body);
    res.json(tokens);
  } catch (err) {
    next(err);
  }
});

authRouter.post('/refresh', validate({ body: refreshSchema }), async (req, res, next) => {
  try {
    const tokens = await authService.refresh(req.body.refreshToken);
    res.json(tokens);
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', validate({ body: logoutSchema }), async (req, res, next) => {
  try {
    await authService.logout(req.body.refreshToken);
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
});
