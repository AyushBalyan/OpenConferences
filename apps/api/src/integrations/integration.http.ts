import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Response } from 'express';

export function isIntegrationUrl(url: string): boolean {
  return /\/integrations(?:\/|\?|$)/.test(url);
}
export function integrationLogUrl(url: string): string {
  return url
    .split(/[?#]/)[0]!
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id');
}
@Injectable()
export class IntegrationNoStore implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    context.switchToHttp().getResponse<Response>().setHeader('Cache-Control', 'no-store');
    return next.handle();
  }
}

// Authentication and invitation URLs may carry bearer secrets. Keep them out of
// request logs, problem instances and telemetry just like integration queries.
export function isSensitiveUrl(url: string) {
  return /\/(?:auth|reviewer-invitations|reviewer-invite|join|sign-in)(?:\/|\?|$)/.test(url);
}
