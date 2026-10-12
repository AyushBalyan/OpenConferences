import { initClient } from '@ts-rest/core';
import { integrationManagementContract } from '@openconferences/contracts';

export const integrationsClient = initClient(integrationManagementContract, {
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1',
  credentials: 'include',
  baseHeaders: {},
});
