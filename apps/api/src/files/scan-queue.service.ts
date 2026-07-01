import { Injectable } from '@nestjs/common';
import type { FileScanJobPayload } from '@openconferences/schemas';
import { QueueService } from '../queue/queue.service';

@Injectable()
export class ScanQueueService {
  constructor(private readonly queue: QueueService) {}

  async enqueueScan(payload: FileScanJobPayload): Promise<string | null> {
    return this.queue.sendFileScan(payload);
  }
}
