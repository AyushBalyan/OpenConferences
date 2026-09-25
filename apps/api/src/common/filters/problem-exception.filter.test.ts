import { ConflictException, type ArgumentsHost } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ProblemExceptionFilter } from './problem-exception.filter';

describe('ProblemExceptionFilter', () => {
  it('preserves a machine-readable phase lock without losing the explanation', () => {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ url: '/reviews/example' }),
        getResponse: () => ({ status }),
      }),
    } as unknown as ArgumentsHost;

    new ProblemExceptionFilter().catch(
      new ConflictException({ code: 'REVIEW_PHASE_LOCKED', message: 'Reviewing has not opened.' }),
      host,
    );

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'REVIEW_PHASE_LOCKED',
        detail: 'Reviewing has not opened.',
        status: 409,
      }),
    );
  });
});
