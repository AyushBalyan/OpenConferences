import { initClient } from '@ts-rest/core';
import { apiContract } from '@openconferences/contracts';

/** Base address of the API, including its base path. Set in .env.redesign. */
export const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3101/api/v1';

/**
 * Typed client for the shared API contract. Every request apps/web-v2 makes
 * goes through this client, so a contract change is a compile error here.
 */
export function createApiClient(options: { fetch?: typeof fetch } = {}) {
  const fetchImpl = options.fetch ?? fetch;

  return initClient(apiContract, {
    baseUrl: apiBaseUrl,
    baseHeaders: {},
    credentials: 'include',
    api: async ({ path, method, headers, body }) => {
      const response = await fetchImpl(path, {
        method,
        headers,
        body,
        credentials: 'include',
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      });
      const contentType = response.headers.get('content-type') ?? '';
      return {
        status: response.status,
        body: contentType.includes('json') ? await response.json() : await response.text(),
        headers: response.headers,
      };
    },
  });
}
