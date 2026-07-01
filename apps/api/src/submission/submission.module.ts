import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { FilesModule } from '../files/files.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { AuthorshipsService } from './authorships.service';
import { PapersService } from './papers.service';
import { SubmissionController } from './submission.controller';
import { VersionsService } from './versions.service';

@Module({
  imports: [AuthModule, TenancyModule, FilesModule, AuditModule],
  controllers: [SubmissionController],
  providers: [PapersService, AuthorshipsService, VersionsService],
  exports: [PapersService],
})
export class SubmissionModule {}
