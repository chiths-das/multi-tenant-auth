import { vi } from 'vitest';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/auth_test';
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long';
process.env.ENCRYPTION_KEY = 'a'.repeat(64); // 32 bytes hex
process.env.PORT = '0';
process.env.CORS_ORIGINS = 'http://localhost:3000';
