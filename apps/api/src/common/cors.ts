/** Keep the HTTP bootstrap and preflight regression checks on the same CORS policy. */
export function apiCorsOptions(origins: string[]) {
  return {
    origin: origins,
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'cf-turnstile-response',
      'X-Requested-With',
      'Idempotency-Key',
    ],
  };
}
