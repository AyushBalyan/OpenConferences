import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { LoggerModule } from 'nestjs-pino';
import { getConfig } from '@openconferences/config/env';
import { HealthModule } from './health/health.module';
import { DebugModule } from './debug/debug.module';
import { RedisModule } from './redis/redis.module';
import { QueueModule } from './queue/queue.module';
import { AuthModule } from './auth/auth.module';
import { TenancyModule } from './tenancy/tenancy.module';
import { SubmissionModule } from './submission/submission.module';
import { ReviewModule } from './review/review.module';
import { BillingModule } from './billing/billing.module';
import { AuditModule } from './audit/audit.module';
import { MailerModule } from './mailer/mailer.module';
import { MessagingModule } from './messaging/messaging.module';
import { TurnstileModule } from './turnstile/turnstile.module';
import { AuthRateLimitMiddleware } from './common/middleware/auth-rate-limit.middleware';
import { APP_FILTER } from '@nestjs/core';
import { ProblemExceptionFilter } from './common/filters/problem-exception.filter';

const config = getConfig();

@Module({
  imports: [
    EventEmitterModule.forRoot({ wildcard: false, delimiter: '.' }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: config.logLevel,
        genReqId: (req) => {
          const existing = req.headers['x-request-id'];
          if (typeof existing === 'string') return existing;
          if (Array.isArray(existing) && existing[0]) return existing[0];
          return crypto.randomUUID();
        },
        customProps: (req) => ({
          requestId: req.id,
        }),
        transport:
          config.isDev && !config.isTest
            ? { target: 'pino-pretty', options: { colorize: true, singleLine: true } }
            : undefined,
      },
    }),
    RedisModule,
    QueueModule,
    AuditModule,
    MailerModule,
    MessagingModule,
    TurnstileModule,
    AuthModule,
    TenancyModule,
    SubmissionModule,
    ReviewModule,
    BillingModule,
    HealthModule,
    ...(config.isDev ? [DebugModule] : []),
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: ProblemExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AuthRateLimitMiddleware).forRoutes('*');
  }
}
