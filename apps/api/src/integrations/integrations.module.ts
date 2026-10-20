import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { IntegrationManagementController, BotReadController } from './integration.controllers';
import { IntegrationStore } from './integration.store';
import { BotReadService } from './bot-read.service';
import { IntegrationLimiter } from './integration.limiter';
import { BotWriteService } from './bot-write.service';
import { BotInvitationsService } from './bot-invitations.service';
import { ReviewModule } from '../review/review.module';
@Module({
  imports: [AuthModule, TenancyModule, ReviewModule],
  controllers: [IntegrationManagementController, BotReadController],
  providers: [
    IntegrationStore,
    BotReadService,
    BotWriteService,
    BotInvitationsService,
    IntegrationLimiter,
  ],
})
export class IntegrationsModule {}
