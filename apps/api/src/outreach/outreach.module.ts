import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { OutreachController } from './outreach.controller';
import { OutreachService } from './outreach.service';
import { OutreachWebhookController } from './outreach-webhook.controller';
import { OutreachWebhookService } from './outreach-webhook.service';

@Module({
  imports: [AuthModule, TenancyModule],
  controllers: [OutreachController, OutreachWebhookController],
  providers: [OutreachService, OutreachWebhookService],
  exports: [OutreachService],
})
export class OutreachModule {}
