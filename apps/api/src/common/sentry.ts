import { isIntegrationUrl } from '../integrations/integration.http';
import * as Sentry from '@sentry/nestjs';
import type { AppConfig } from '@openconferences/config/env';

export function initSentry(config: AppConfig): void {
  if (!config.sentryDsn) {
    return;
  }

  Sentry.init({
    dsn: config.sentryDsn,
    beforeSend(event) {
      // Integration telemetry is handled by sanitized, durable metadata records.
      if (isIntegrationUrl(event.request?.url ?? '')) return null;
      return event;
    },
    beforeSendTransaction(event) {
      if (isIntegrationUrl(event.request?.url ?? '') || isIntegrationUrl(event.transaction ?? ''))
        return null;
      return event;
    },
    environment: config.nodeEnv,
    tracesSampleRate: config.isProd ? 0.1 : 1.0,
  });
}
