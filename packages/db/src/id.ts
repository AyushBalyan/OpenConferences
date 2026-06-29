import { v7 as uuidv7 } from 'uuid';

/**
 * Generate a time-sortable UUIDv7 primary key (§4).
 * IDs must be generated in the application layer, not via Postgres random UUID.
 */
export function generateId(): string {
  return uuidv7();
}
