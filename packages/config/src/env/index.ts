import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

let envLoaded = false;

function ensureEnvLoaded(): void {
  if (envLoaded || process.env.SKIP_ENV_FILE === 'true') {
    return;
  }

  const candidates = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '../../.env'),
    resolve(process.cwd(), '../../../.env'),
  ];

  for (const path of candidates) {
    if (existsSync(path)) {
      loadDotenv({ path });
      envLoaded = true;
      return;
    }
  }

  envLoaded = true;
}

const nodeEnvSchema = z.enum(['development', 'test', 'production']);

const baseEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema.default('development'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  S3_ENDPOINT: z.string().url(),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_REGION: z.string().default('us-east-1'),
  S3_FORCE_PATH_STYLE: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  API_HOST: z.string().default('0.0.0.0'),
  API_BASE_PATH: z.string().default('/api/v1'),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((v) => v.split(',').map((s) => s.trim())),
  SENTRY_DSN: z.string().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  WEB_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:3001/api/v1'),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url().default('http://localhost:3001'),
  AUTH_LOCKOUT_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  AUTH_LOCKOUT_WINDOW_SECONDS: z.coerce.number().int().positive().default(900),
  MAIL_FROM: z
    .string()
    .refine(
      (value) => {
        const match = value.match(/^(.+?\s*)?<([^>]+)>$/);
        const email = (match?.[2] ?? value).trim();
        return z.string().email().safeParse(email).success;
      },
      { message: 'Invalid MAIL_FROM address' },
    )
    .default('OpenConferences <noreply@example.com>'),
  MAIL_FROM_NAME: z.string().optional(),
  ZEPTO_MAIL_API_KEY: z.string().optional(),
  ZEPTO_MAIL_API_URL: z.string().url().default('https://api.zeptomail.in/v1.1/email'),
  ZEPTO_WEBHOOK_SECRET: z.string().optional(),
  NOTIFICATION_RETENTION_DAYS: z.coerce.number().int().positive().default(365),
  TURNSTILE_SECRET_KEY: z.string().optional(),
  CLAMAV_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),
  CLAMAV_HOST: z.string().default('127.0.0.1'),
  CLAMAV_PORT: z.coerce.number().int().positive().default(3310),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  REGISTRATION_ADDITIONAL_GRACE_DAYS: z.coerce.number().int().nonnegative().default(7),
  PAYMENT_WEBHOOK_REPLAY_WINDOW_SECONDS: z.coerce.number().int().positive().default(300),
});

export type AppConfig = {
  nodeEnv: z.infer<typeof nodeEnvSchema>;
  databaseUrl: string;
  redisUrl: string;
  s3: {
    endpoint: string;
    accessKey: string;
    secretKey: string;
    bucket: string;
    region: string;
    forcePathStyle: boolean;
  };
  api: {
    port: number;
    host: string;
    basePath: string;
    corsOrigins: string[];
  };
  sentryDsn?: string;
  logLevel: string;
  webUrl: string;
  nextPublicApiUrl: string;
  auth: {
    secret: string;
    url: string;
    basePath: string;
    lockoutMaxAttempts: number;
    lockoutWindowSeconds: number;
  };
  mail: {
    from: string;
    fromName?: string;
    zeptoApiKey?: string;
    zeptoApiUrl: string;
    zeptoWebhookSecret?: string;
    retentionDays: number;
  };
  turnstileSecretKey?: string;
  clamav: {
    enabled: boolean;
    host: string;
    port: number;
  };
  razorpay: {
    keyId?: string;
    keySecret?: string;
    webhookSecret?: string;
  };
  billing: {
    additionalGraceDays: number;
    webhookReplayWindowSeconds: number;
  };
  isDev: boolean;
  isTest: boolean;
  isProd: boolean;
};

let cachedConfig: AppConfig | null = null;

function parseEnv(env: Record<string, string | undefined> = process.env): AppConfig {
  ensureEnvLoaded();
  const result = baseEnvSchema.safeParse(env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${formatted}`);
  }

  const data = result.data;

  return {
    nodeEnv: data.NODE_ENV,
    databaseUrl: data.DATABASE_URL,
    redisUrl: data.REDIS_URL,
    s3: {
      endpoint: data.S3_ENDPOINT,
      accessKey: data.S3_ACCESS_KEY,
      secretKey: data.S3_SECRET_KEY,
      bucket: data.S3_BUCKET,
      region: data.S3_REGION,
      forcePathStyle: data.S3_FORCE_PATH_STYLE ?? true,
    },
    api: {
      port: data.API_PORT,
      host: data.API_HOST,
      basePath: data.API_BASE_PATH,
      corsOrigins: data.CORS_ORIGINS,
    },
    sentryDsn: data.SENTRY_DSN,
    logLevel: data.LOG_LEVEL,
    webUrl: data.WEB_URL,
    nextPublicApiUrl: data.NEXT_PUBLIC_API_URL,
    auth: {
      secret: data.BETTER_AUTH_SECRET,
      url: data.BETTER_AUTH_URL,
      basePath: `${data.API_BASE_PATH.replace(/\/$/, '')}/auth`,
      lockoutMaxAttempts: data.AUTH_LOCKOUT_MAX_ATTEMPTS,
      lockoutWindowSeconds: data.AUTH_LOCKOUT_WINDOW_SECONDS,
    },
    mail: {
      from: data.MAIL_FROM,
      fromName: data.MAIL_FROM_NAME,
      zeptoApiKey: data.ZEPTO_MAIL_API_KEY,
      zeptoApiUrl: data.ZEPTO_MAIL_API_URL,
      zeptoWebhookSecret: data.ZEPTO_WEBHOOK_SECRET,
      retentionDays: data.NOTIFICATION_RETENTION_DAYS,
    },
    turnstileSecretKey: data.TURNSTILE_SECRET_KEY,
    clamav: {
      enabled: data.CLAMAV_ENABLED ?? false,
      host: data.CLAMAV_HOST,
      port: data.CLAMAV_PORT,
    },
    razorpay: {
      keyId: data.RAZORPAY_KEY_ID,
      keySecret: data.RAZORPAY_KEY_SECRET,
      webhookSecret: data.RAZORPAY_WEBHOOK_SECRET,
    },
    billing: {
      additionalGraceDays: data.REGISTRATION_ADDITIONAL_GRACE_DAYS,
      webhookReplayWindowSeconds: data.PAYMENT_WEBHOOK_REPLAY_WINDOW_SECONDS,
    },
    isDev: data.NODE_ENV === 'development',
    isTest: data.NODE_ENV === 'test',
    isProd: data.NODE_ENV === 'production',
  };
}

export function getConfig(env?: Record<string, string | undefined>): AppConfig {
  if (env) {
    return parseEnv(env);
  }
  if (!cachedConfig) {
    cachedConfig = parseEnv();
  }
  return cachedConfig;
}

export function resetConfig(): void {
  cachedConfig = null;
}

export { baseEnvSchema };
