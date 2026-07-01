import { Global, Module } from '@nestjs/common';
import { TenancyModule } from '../tenancy/tenancy.module';
import { QueueModule } from '../queue/queue.module';
import { MessagingController } from './messaging.controller';
import { MessagingWebhookController } from './messaging-webhook.controller';
import { NotificationService } from './notification.service';
import { NotificationPublisher } from './notification.publisher';
import { NotificationSubscriber } from './notification.subscriber';
import { TemplateService } from './template.service';
import { MessagingWebhookService } from './messaging-webhook.service';

@Global()
@Module({
  imports: [TenancyModule, QueueModule],
  controllers: [MessagingController, MessagingWebhookController],
  providers: [
    NotificationService,
    NotificationPublisher,
    NotificationSubscriber,
    TemplateService,
    MessagingWebhookService,
  ],
  exports: [NotificationService, NotificationPublisher, TemplateService],
})
export class MessagingModule {}
