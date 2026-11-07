import { Injectable, NestMiddleware, PayloadTooLargeException } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

/** Bound validation work before schemas can allocate an issue for every invalid element. */
export function assertPayloadComplexity(value: unknown, maxNodes = 5000): void {
  const pending: Array<{ value: unknown; depth: number }> = [{ value, depth: 0 }];
  let nodes = 0;
  while (pending.length) {
    const current = pending.pop()!;
    if (++nodes > maxNodes || current.depth > 32)
      throw new PayloadTooLargeException('Request structure is too complex');
    if (!current.value || typeof current.value !== 'object') continue;
    const values = Object.values(current.value);
    if (values.length > 1000) throw new PayloadTooLargeException('Request collection is too large');
    for (const child of values) pending.push({ value: child, depth: current.depth + 1 });
  }
}
@Injectable()
export class PayloadComplexityMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    const structuredBatch =
      req.method === 'POST' &&
      /\/integrations\/v1\/conferences\/[0-9a-f-]{36}\/reviewer-operations\/invitation-batches\/?$/.test(
        req.path,
      );
    assertPayloadComplexity(req.body, structuredBatch ? 45000 : 5000);
    assertPayloadComplexity(req.query);
    next();
  }
}
