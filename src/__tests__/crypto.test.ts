import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  sha256,
  generateRandomToken,
  encrypt,
  decrypt,
  hmacSign,
  timingSafeEqual,
} from '../lib/crypto.js';

describe('Crypto utilities', () => {
  describe('password hashing', () => {
    it('hashes and verifies a password', async () => {
      const password = 'test-password-123';
      const hash = await hashPassword(password);
      expect(hash).not.toBe(password);
      expect(await verifyPassword(password, hash)).toBe(true);
      expect(await verifyPassword('wrong-password', hash)).toBe(false);
    });
  });

  describe('sha256', () => {
    it('produces consistent hashes', () => {
      const hash1 = sha256('test');
      const hash2 = sha256('test');
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });
  });

  describe('generateRandomToken', () => {
    it('generates tokens of correct length', () => {
      const token = generateRandomToken(32);
      expect(token).toHaveLength(64); // 32 bytes = 64 hex chars
    });

    it('generates unique tokens', () => {
      const t1 = generateRandomToken();
      const t2 = generateRandomToken();
      expect(t1).not.toBe(t2);
    });
  });

  describe('AES-256-GCM encryption', () => {
    it('encrypts and decrypts correctly', () => {
      const plaintext = 'my-secret-client-secret';
      const ciphertext = encrypt(plaintext);
      expect(ciphertext).not.toBe(plaintext);
      expect(ciphertext.split(':')).toHaveLength(3);
      const decrypted = decrypt(ciphertext);
      expect(decrypted).toBe(plaintext);
    });

    it('produces different ciphertext for same input (random IV)', () => {
      const plaintext = 'same-input';
      const c1 = encrypt(plaintext);
      const c2 = encrypt(plaintext);
      expect(c1).not.toBe(c2);
      expect(decrypt(c1)).toBe(decrypt(c2));
    });
  });

  describe('hmacSign', () => {
    it('produces consistent signatures', () => {
      const sig1 = hmacSign('data', 'secret');
      const sig2 = hmacSign('data', 'secret');
      expect(sig1).toBe(sig2);
    });

    it('different data produces different signatures', () => {
      const sig1 = hmacSign('data1', 'secret');
      const sig2 = hmacSign('data2', 'secret');
      expect(sig1).not.toBe(sig2);
    });
  });

  describe('timingSafeEqual', () => {
    it('returns true for equal strings', () => {
      expect(timingSafeEqual('abc', 'abc')).toBe(true);
    });

    it('returns false for different strings', () => {
      expect(timingSafeEqual('abc', 'abd')).toBe(false);
    });

    it('returns false for different lengths', () => {
      expect(timingSafeEqual('abc', 'abcd')).toBe(false);
    });
  });
});
