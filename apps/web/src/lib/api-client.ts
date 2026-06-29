import { initClient } from '@ts-rest/core';
import { apiContract } from '@openconferences/contracts';

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export const apiClient = initClient(apiContract, {
  baseUrl,
  baseHeaders: {},
  credentials: 'include',
});

export async function fetchHealthz() {
  const result = await apiClient.health.healthz();
  if (result.status === 200) {
    return result.body;
  }
  throw new Error(`Health check failed with status ${result.status}`);
}

export async function fetchMe() {
  const result = await apiClient.auth.me();
  if (result.status === 200) {
    return result.body;
  }
  return null;
}
