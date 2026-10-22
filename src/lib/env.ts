import 'server-only';
import { z } from 'zod';

/**
 * Server-only environment configuration schema validated with Zod.
 * Never import this file into Client Components.
 */
const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL environment variable is required')
    .refine(
      (url) => url.startsWith('postgresql://') || url.startsWith('postgres://'),
      {
        message: 'DATABASE_URL must be a valid PostgreSQL connection string starting with postgresql:// or postgres://',
      }
    ),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
});

export type EnvConfig = z.infer<typeof envSchema>;

let cachedEnv: EnvConfig | null = null;

/**
 * Returns validated server environment variables.
 * Caches validated environment on subsequent invocations.
 */
export function getValidatedEnv(): EnvConfig {
  if (cachedEnv) {
    return cachedEnv;
  }

  const result = envSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
  });

  if (!result.success) {
    const errorMessages = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'configuration'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Environment validation failed: ${errorMessages}`);
  }

  cachedEnv = result.data;
  return cachedEnv;
}
