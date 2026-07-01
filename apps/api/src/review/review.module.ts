import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { BillingModule } from '../billing/billing.module';
import { AssignmentsService } from './assignments.service';
import { BidsService, CoiService } from './bids.service';
import { CoiCheckService } from './coi-check.service';
import { InvitationsService } from './invitations.service';
import { RebuttalsService } from './rebuttals.service';
import { DecisionsService } from './decisions.service';
import { ReviewController, ReviewInvitationController } from './review.controller';
import { ReviewsService } from './reviews.service';
import { RoundsService } from './rounds.service';

@Module({
  imports: [AuthModule, TenancyModule, AuditModule, BillingModule],
  controllers: [ReviewController, ReviewInvitationController],
  providers: [
    RoundsService,
    InvitationsService,
    BidsService,
    CoiService,
    CoiCheckService,
    AssignmentsService,
    ReviewsService,
    RebuttalsService,
    DecisionsService,
  ],
  exports: [
    RoundsService,
    AssignmentsService,
    CoiCheckService,
    ReviewsService,
    RebuttalsService,
    DecisionsService,
  ],
})
export class ReviewModule {}
