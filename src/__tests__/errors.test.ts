import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { AppError, UnauthorizedError, ForbiddenError, NotFoundError, ConflictError, ValidationError } from '../lib/errors.js';
import { errorHandler } from '../middleware/errorHandler.js';

describe('Error handling', () => {
  function createTestApp(err: Error) {
    const app = express();
    app.get('/test', () => { throw err; });
    app.use(errorHandler);
    return app;
  }

  it('handles AppError', async () => {
    const app = createTestApp(new AppError(400, 'Bad request', 'BAD_REQUEST'));
    const res = await request(app).get('/test');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('handles UnauthorizedError', async () => {
    const app = createTestApp(new UnauthorizedError());
    const res = await request(app).get('/test');
    expect(res.status).toBe(401);
  });

  it('handles ForbiddenError', async () => {
    const app = createTestApp(new ForbiddenError());
    const res = await request(app).get('/test');
    expect(res.status).toBe(403);
  });

  it('handles NotFoundError', async () => {
    const app = createTestApp(new NotFoundError());
    const res = await request(app).get('/test');
    expect(res.status).toBe(404);
  });

  it('handles ConflictError', async () => {
    const app = createTestApp(new ConflictError());
    const res = await request(app).get('/test');
    expect(res.status).toBe(409);
  });

  it('handles ValidationError with details', async () => {
    const app = createTestApp(new ValidationError('Bad data', { field: 'email' }));
    const res = await request(app).get('/test');
    expect(res.status).toBe(422);
    expect(res.body.error.details).toEqual({ field: 'email' });
  });

  it('handles unknown errors as 500', async () => {
    const app = createTestApp(new Error('Something broke'));
    const res = await request(app).get('/test');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });
});
