import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { apiCorsOptions } from './cors';

describe('payment checkout CORS preflight', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({}).compile();
    app = module.createNestApplication();
    app.enableCors(apiCorsOptions(['https://app.fresi.org']));
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
  });

  it('permits the browser payment POST with its idempotency header and session cookie', async () => {
    const response = await request(app.getHttpServer())
      .options('/api/v1/conferences/conference/papers/paper/registration/payment')
      .set('Origin', 'https://app.fresi.org')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,idempotency-key')
      .expect(204);
    expect(response.headers['access-control-allow-origin']).toBe('https://app.fresi.org');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
    const allowed = response.headers['access-control-allow-headers']
      .toLowerCase()
      .split(',')
      .map((value: string) => value.trim());
    expect(allowed).toContain('idempotency-key');
    expect(allowed).toContain('content-type');
  });

  it('does not allow an unconfigured frontend origin', async () => {
    const response = await request(app.getHttpServer())
      .options('/api/v1/conferences/conference/papers/paper/registration/payment')
      .set('Origin', 'https://untrusted.example')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,idempotency-key')
      .expect(204);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});
