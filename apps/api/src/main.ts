import type { NestExpressApplication } from '@nestjs/platform-express';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import { getConfig } from '@openconferences/config/env';
import { assertSafeDatabaseRole } from '@openconferences/db';
import { AppModule } from './app.module';
import { initSentry } from './common/sentry';
import { apiCorsOptions } from './common/cors';

async function bootstrap(): Promise<void> {
  // Plain console before Nest logger exists — visible in Coolify docker logs during hangs.
  console.log('[boot] loading config');
  const config = getConfig();
  initSentry(config);

  console.log(`[boot] object store ${config.s3.endpoint} bucket=${config.s3.bucket}`);
  console.log('[boot] asserting database role (first Postgres connect)');
  await assertSafeDatabaseRole();
  console.log('[boot] database role ok; creating Nest app (includes pg-boss start)');

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });

  app.useBodyParser('json', { limit: '2mb' });

  const logger = app.get(Logger);
  app.useLogger(logger);

  const trustedProxies = process.env.API_TRUSTED_PROXY_CIDRS?.split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (trustedProxies?.length) app.set('trust proxy', trustedProxies);

  app.use(helmet());
  app.enableCors(apiCorsOptions(config.api.corsOrigins));

  app.setGlobalPrefix(config.api.basePath.replace(/^\//, ''));

  console.log(`[boot] binding ${config.api.host}:${config.api.port}`);
  await app.listen(config.api.port, config.api.host);
  logger.log(`API listening on http://${config.api.host}:${config.api.port}${config.api.basePath}`);
}

bootstrap().catch((err: unknown) => {
  console.error('Failed to start API:', err);
  process.exit(1);
});
