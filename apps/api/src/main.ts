import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import { getConfig } from '@openconferences/config/env';
import { AppModule } from './app.module';
import { initSentry } from './common/sentry';

async function bootstrap(): Promise<void> {
  const config = getConfig();
  initSentry(config);

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const logger = app.get(Logger);
  app.useLogger(logger);

  app.use(helmet());
  app.enableCors({
    origin: config.api.corsOrigins,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'cf-turnstile-response', 'X-Requested-With'],
  });

  app.setGlobalPrefix(config.api.basePath.replace(/^\//, ''));

  await app.listen(config.api.port, config.api.host);
  logger.log(`API listening on http://${config.api.host}:${config.api.port}${config.api.basePath}`);
}

bootstrap().catch((err: unknown) => {
  console.error('Failed to start API:', err);
  process.exit(1);
});
