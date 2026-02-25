import { describe, it, expect } from 'vitest';
import { issueAccessToken, verifyAccessToken } from '../modules/tokens/token.service.js';

describe('Token service', () => {
  describe('access tokens', () => {
    const payload = {
      sub: '123e4567-e89b-12d3-a456-426614174000',
      tid: '223e4567-e89b-12d3-a456-426614174000',
      role: 'admin',
      permissions: ['users:read', 'users:write'],
    };

    it('issues and verifies a JWT access token', () => {
      const token = issueAccessToken(payload);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const decoded = verifyAccessToken(token);
      expect(decoded.sub).toBe(payload.sub);
      expect(decoded.tid).toBe(payload.tid);
      expect(decoded.role).toBe(payload.role);
      expect(decoded.permissions).toEqual(payload.permissions);
    });

    it('throws on invalid token', () => {
      expect(() => verifyAccessToken('invalid-token')).toThrow('Invalid or expired access token');
    });
  });
});
