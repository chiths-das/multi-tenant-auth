import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import * as userService from './user.service.js';

export const userRouter = Router();

userRouter.use(authenticate);

userRouter.get('/me', async (req, res, next) => {
  try {
    const profile = await userService.getProfile(req.userId!);
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8).max(128),
});

userRouter.patch('/me/password', validate({ body: changePasswordSchema }), async (req, res, next) => {
  try {
    await userService.changePassword(req.userId!, req.body.currentPassword, req.body.newPassword);
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
});

userRouter.get('/me/linked-accounts', async (req, res, next) => {
  try {
    const accounts = await userService.getLinkedAccounts(req.userId!);
    res.json(accounts);
  } catch (err) {
    next(err);
  }
});
