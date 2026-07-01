import { Global, Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { MailerService } from './mailer.service';

@Global()
@Module({
  imports: [QueueModule],
  providers: [MailerService],
  exports: [MailerService],
})
export class MailerModule {}
