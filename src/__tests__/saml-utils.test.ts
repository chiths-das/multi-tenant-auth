import { describe, it, expect } from 'vitest';
import { computeCertFingerprint, validateCertFingerprint, generateSpMetadata } from '../lib/saml-utils.js';

// Minimal self-signed cert for testing
const TEST_CERT = `-----BEGIN CERTIFICATE-----
MIIBkTCB+wIJALRiMLAh0ESYMA0GCSqGSIb3DQEBCwUAMBExDzANBgNVBAMMBnRl
c3RjYTAeFw0yNDAxMDEwMDAwMDBaFw0yNTAxMDEwMDAwMDBaMBExDzANBgNVBAMM
BnRlc3RjYTBcMA0GCSqGSIb3DQEBAQUAA0sAMEgCQQC7o96FCzBPs+JVnMqN1MNx
1oPDGQwGfBgwZWFEZGw1LhAbE0tBp2LYOwd0TSDKM2MNJoZ7fe7qrXWcRp/VIvkN
AgMBAAEwDQYJKoZIhvcNAQELBQADQQBF8MjNXvfqdRnVMmCtXdSk2r6E0gTuLD8r
aVPMnFugIXkOa/mJhFJWkFt9FqMnGIWT4x6QV6DZsslM2l/bFI8L
-----END CERTIFICATE-----`;

describe('SAML utilities', () => {
  describe('computeCertFingerprint', () => {
    it('computes a SHA-256 fingerprint', () => {
      const fp = computeCertFingerprint(TEST_CERT);
      expect(fp).toHaveLength(64);
      expect(fp).toMatch(/^[A-F0-9]+$/);
    });
  });

  describe('validateCertFingerprint', () => {
    it('validates a correct fingerprint', () => {
      const fp = computeCertFingerprint(TEST_CERT);
      expect(validateCertFingerprint(TEST_CERT, fp)).toBe(true);
    });

    it('rejects an incorrect fingerprint', () => {
      expect(validateCertFingerprint(TEST_CERT, 'A'.repeat(64))).toBe(false);
    });
  });

  describe('generateSpMetadata', () => {
    it('generates valid SP metadata XML', () => {
      const xml = generateSpMetadata(
        'https://sp.example.com',
        'https://sp.example.com/acs',
      );
      expect(xml).toContain('EntityDescriptor');
      expect(xml).toContain('entityID="https://sp.example.com"');
      expect(xml).toContain('Location="https://sp.example.com/acs"');
    });
  });
});
