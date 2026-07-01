import { Injectable, Logger } from '@nestjs/common';
import type { Request } from 'express';
import { getConfig } from '@openconferences/config/env';

export const TURNSTILE_RESPONSE_HEADER = 'cf-turnstile-response';

type SiteVerifyResponse = {
  success?: boolean;
  'error-codes'?: string[];
};

@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name);

  isEnabled(): boolean {
    const config = getConfig();
    // Optional in local dev — enforced in staging/production only.
    return Boolean(config.turnstileSecretKey) && !config.isTest && !config.isDev;
  }

  extractToken(req: Request): string | undefined {
    const fromHeader = req.headers[TURNSTILE_RESPONSE_HEADER];
    if (typeof fromHeader === 'string' && fromHeader.length > 0) {
      return fromHeader;
    }
    if (Array.isArray(fromHeader) && fromHeader[0]) {
      return fromHeader[0];
    }

    if (req.body && typeof req.body === 'object' && 'cfTurnstileResponse' in req.body) {
      const value = (req.body as { cfTurnstileResponse?: unknown }).cfTurnstileResponse;
      if (typeof value === 'string' && value.length > 0) {
        return value;
      }
    }

    return undefined;
  }

  async verify(token: string, remoteIp?: string): Promise<boolean> {
    const secret = getConfig().turnstileSecretKey;
    if (!secret) {
      return true;
    }

    const body = new URLSearchParams({
      secret,
      response: token,
    });

    if (remoteIp) {
      body.set('remoteip', remoteIp);
    }

    try {
      const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });

      if (!response.ok) {
        this.logger.warn({ status: response.status }, 'Turnstile siteverify HTTP error');
        return false;
      }

      const data = (await response.json()) as SiteVerifyResponse;
      if (!data.success) {
        this.logger.debug({ errorCodes: data['error-codes'] }, 'Turnstile verification failed');
      }
      return data.success === true;
    } catch (err) {
      this.logger.error({ err }, 'Turnstile siteverify request failed');
      return false;
    }
  }
}
