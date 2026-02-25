import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { errorHandler } from '../middleware/errorHandler.js';

describe('Validation middleware', () => {
  const app = express();
  app.use(express.json());

  const schema = z.object({
    email: z.string().email(),
    name: z.string().min(1),
  });

  app.post('/test', validate({ body: schema }), (req, res) => {
    res.json({ email: req.body.email, name: req.body.name });
  });

  app.use(errorHandler);

  it('passes valid input', async () => {
    const res = await request(app)
      .post('/test')
      .send({ email: 'test@example.com', name: 'Test' });
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('test@example.com');
  });

  it('rejects invalid input with 422', async () => {
    const res = await request(app)
      .post('/test')
      .send({ email: 'not-an-email', name: '' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
