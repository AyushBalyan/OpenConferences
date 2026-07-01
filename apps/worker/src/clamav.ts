import net from 'node:net';

const CHUNK_SIZE = 64 * 1024;
const DEFAULT_TIMEOUT_MS = 120_000;

/**
 * Scan bytes via ClamAV clamd INSTREAM protocol (TCP).
 * @see https://docs.clamav.net/manual/Usage/Scanning.html
 */
export function scanBufferWithClamAV(
  buffer: Buffer,
  host: string,
  port: number,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<'CLEAN' | 'INFECTED'> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    let settled = false;
    const responseChunks: Buffer[] = [];

    const finish = (result: 'CLEAN' | 'INFECTED' | Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      if (result instanceof Error) {
        reject(result);
      } else {
        resolve(result);
      }
    };

    const timer = setTimeout(() => {
      finish(new Error('ClamAV scan timed out'));
    }, timeoutMs);

    socket.on('error', (err) => finish(err));

    socket.once('connect', () => {
      try {
        socket.write('zINSTREAM\0');

        for (let offset = 0; offset < buffer.length; offset += CHUNK_SIZE) {
          const slice = buffer.subarray(offset, Math.min(offset + CHUNK_SIZE, buffer.length));
          const len = Buffer.alloc(4);
          len.writeUInt32BE(slice.length, 0);
          socket.write(len);
          socket.write(slice);
        }

        const end = Buffer.alloc(4);
        end.writeUInt32BE(0, 0);
        socket.write(end);
      } catch (err) {
        finish(err instanceof Error ? err : new Error(String(err)));
      }
    });

    socket.on('data', (data) => responseChunks.push(data));

    socket.on('end', () => {
      const response = Buffer.concat(responseChunks).toString('utf8').trim();
      if (response.includes('FOUND')) {
        finish('INFECTED');
      } else if (response.includes('OK')) {
        finish('CLEAN');
      } else {
        finish(new Error(`Unexpected ClamAV response: ${response || '(empty)'}`));
      }
    });
  });
}
