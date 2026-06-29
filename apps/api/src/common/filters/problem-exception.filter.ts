import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ProblemEnvelope } from '@openconferences/schemas';

@Catch()
export class ProblemExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, envelope } = this.toProblemEnvelope(exception, request.url);

    if (status >= 500) {
      this.logger.error(
        { err: exception, requestId: request.id },
        envelope.detail ?? envelope.title,
      );
    }

    response.status(status).json(envelope);
  }

  private toProblemEnvelope(
    exception: unknown,
    instance: string,
  ): { status: number; envelope: ProblemEnvelope } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const detail =
        typeof response === 'string'
          ? response
          : typeof response === 'object' && response !== null && 'detail' in response
            ? String((response as { detail: unknown }).detail)
            : typeof response === 'object' && response !== null && 'message' in response
              ? Array.isArray((response as { message: unknown }).message)
                ? (response as { message: string[] }).message.join(', ')
                : String((response as { message: unknown }).message)
              : exception.message;

      return {
        status,
        envelope: {
          type: this.typeForStatus(status),
          title: HttpStatus[status] ?? 'Error',
          status,
          detail,
          instance,
        },
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      envelope: {
        type: 'https://errors.openconf.dev/internal-server-error',
        title: 'Internal Server Error',
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        detail: 'An unexpected error occurred',
        instance,
      },
    };
  }

  private typeForStatus(status: number): string {
    const map: Record<number, string> = {
      400: 'https://errors.openconf.dev/bad-request',
      401: 'https://errors.openconf.dev/unauthorized',
      403: 'https://errors.openconf.dev/forbidden',
      404: 'https://errors.openconf.dev/not-found',
      409: 'https://errors.openconf.dev/conflict',
      422: 'https://errors.openconf.dev/unprocessable-entity',
      429: 'https://errors.openconf.dev/too-many-requests',
    };
    return map[status] ?? 'https://errors.openconf.dev/error';
  }
}
