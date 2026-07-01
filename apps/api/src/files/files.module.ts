import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { FilesService } from './files.service';
import { ScanQueueService } from './scan-queue.service';

@Module({
  imports: [AuditModule],
  providers: [FilesService, ScanQueueService],
  exports: [FilesService, ScanQueueService],
})
export class FilesModule {}
