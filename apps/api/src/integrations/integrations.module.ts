import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { IntegrationManagementController, BotReadController } from './integration.controllers';
import { IntegrationStore } from './integration.store';
import { BotReadService } from './bot-read.service';
import { IntegrationLimiter } from './integration.limiter';
@Module({
  imports: [AuthModule, TenancyModule],
  controllers: [IntegrationManagementController, BotReadController],
  providers: [IntegrationStore, BotReadService, IntegrationLimiter],
})
export class IntegrationsModule {}
