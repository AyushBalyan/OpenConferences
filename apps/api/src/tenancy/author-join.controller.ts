import { Controller, UseGuards } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { conferencesContract } from '@openconferences/contracts';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { ConferenceService } from './conference.service';

@Controller()
@UseGuards(AuthGuard)
export class AuthorJoinController {
  constructor(private readonly conferences: ConferenceService) {}

  @TsRestHandler(conferencesContract.joinAsAuthor)
  joinAsAuthor(@CurrentUser() user: AuthUser) {
    return tsRestHandler(conferencesContract.joinAsAuthor, async ({ body }) => {
      const result = await this.conferences.joinAsAuthor(user.id, body.token);
      return { status: 200 as const, body: result };
    });
  }
}
