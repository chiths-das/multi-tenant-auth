import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().length(64).regex(/^[0-9a-fA-F]+$/, 'Must be 64 hex characters'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  BASE_URL: z.string().default('http://localhost:3000'),
});

export type Env = z.infer<typeof envSchema>;

let env: Env;

export function loadEnv(): Env {
  if (env) return env;
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment variables:', result.error.flatten().fieldErrors);
    process.exit(1);
  }
  env = result.data;
  return env;
}

export function getEnv(): Env {
  if (!env) return loadEnv();
  return env;
}
