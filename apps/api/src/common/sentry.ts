import * as Sentry from '@sentry/nestjs';
import type { AppConfig } from '@openconferences/config/env';

export function initSentry(config: AppConfig): void {
  if (!config.sentryDsn) {
    return;
  }

  Sentry.init({
    dsn: config.sentryDsn,
    environment: config.nodeEnv,
    tracesSampleRate: config.isProd ? 0.1 : 1.0,
  });
}
