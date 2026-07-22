import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { OrganizationsController } from './organizations.controller';
import { ConferencesController } from './conferences.controller';
import { AuthorJoinController } from './author-join.controller';
import { OrganizationService } from './organization.service';
import { ConferenceService } from './conference.service';
import { LifecycleService } from './lifecycle.service';
import { RoleGrantService } from './role-grant.service';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [OrganizationsController, ConferencesController, AuthorJoinController],
  providers: [OrganizationService, ConferenceService, LifecycleService, RoleGrantService],
  exports: [OrganizationService, ConferenceService, RoleGrantService],
})
export class TenancyModule {}
