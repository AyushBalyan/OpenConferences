import { healthResponseSchema, readinessResponseSchema } from '@openconferences/schemas';
import type { HealthResponse, ReadinessResponse } from '@openconferences/schemas';
import { createApiClient } from './api';

export type ApiHealth =
  | { reachable: false; reason: string }
  | { reachable: true; liveness: HealthResponse; readiness: ReadinessResponse };

/**
 * Ask the API for its liveness and readiness through the shared contract.
 * Never throws: an API that is down or answers with an unexpected shape is
 * reported as unreachable, with the reason.
 */
export async function getApiHealth(options: { fetch?: typeof fetch } = {}): Promise<ApiHealth> {
  const client = createApiClient(options);

  try {
    const [liveness, readiness] = await Promise.all([
      client.health.healthz(),
      client.health.readyz(),
    ]);

    if (liveness.status !== 200) {
      return {
        reachable: false,
        reason: `The API answered ${liveness.status} to its liveness check.`,
      };
    }
    if (readiness.status !== 200 && readiness.status !== 503) {
      return {
        reachable: false,
        reason: `The API answered ${readiness.status} to its readiness check.`,
      };
    }

    const livenessBody = healthResponseSchema.safeParse(liveness.body);
    const readinessBody = readinessResponseSchema.safeParse(readiness.body);
    if (!livenessBody.success || !readinessBody.success) {
      return {
        reachable: false,
        reason: 'The API answered in a shape the contract does not allow.',
      };
    }

    return { reachable: true, liveness: livenessBody.data, readiness: readinessBody.data };
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown error';
    return { reachable: false, reason: `The API could not be reached (${detail}).` };
  }
}
