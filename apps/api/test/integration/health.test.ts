import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import request from 'supertest';
import { getConfig } from '@openconferences/config/env';
import { HealthModule } from '../../src/health/health.module.ts';
import { RedisModule } from '../../src/redis/redis.module.ts';
import { APP_FILTER } from '@nestjs/core';
import { ProblemExceptionFilter } from '../../src/common/filters/problem-exception.filter.ts';

describe('Health integration', () => {
  let app: INestApplication;
  const config = getConfig();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        LoggerModule.forRoot({
          pinoHttp: {
            level: 'silent',
          },
        }),
        RedisModule,
        HealthModule,
      ],
      providers: [
        {
          provide: APP_FILTER,
          useClass: ProblemExceptionFilter,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(config.api.basePath.replace(/^\//, ''));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/healthz returns 200 with ok status', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/healthz').expect(200);

    expect(response.body).toMatchObject({
      status: 'ok',
    });
    expect(response.body.timestamp).toBeDefined();
  });
});
