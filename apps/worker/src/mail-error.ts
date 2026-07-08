/** Normalize Zepto Mail / fetch rejections into a readable string. */
export function formatMailError(err: unknown): string {
  if (err instanceof Error) {
    // Already normalized by mailer catch — but unwrap nested Zepto payloads in message if JSON.
    if (err.message.startsWith('{')) {
      try {
        return formatMailError(JSON.parse(err.message));
      } catch {
        return err.message;
      }
    }
    return err.message;
  }

  if (typeof err === 'string') {
    return err;
  }

  if (err && typeof err === 'object') {
    const record = err as Record<string, unknown>;

    const nested = record.error;
    if (nested && typeof nested === 'object') {
      const api = nested as Record<string, unknown>;
      const parts: string[] = [];

      if (api.message !== undefined) {
        parts.push(String(api.message));
      }
      if (api.code !== undefined) {
        parts.push(`code=${String(api.code)}`);
      }

      const details = api.details;
      if (Array.isArray(details)) {
        for (const item of details) {
          if (item && typeof item === 'object') {
            const d = item as Record<string, unknown>;
            const detailMsg = [d.code, d.message, d.target_value].filter(Boolean).join(': ');
            if (detailMsg) parts.push(detailMsg);
          }
        }
      }

      if (api.request_id !== undefined) {
        parts.push(`request_id=${String(api.request_id)}`);
      }

      if (parts.length > 0) {
        return parts.join(' | ');
      }
    }

    if (record.message !== undefined) {
      return String(record.message);
    }

    if (record.code !== undefined) {
      return String(record.code);
    }

    try {
      return JSON.stringify(err);
    } catch {
      return '[unserializable error]';
    }
  }

  return String(err);
}
