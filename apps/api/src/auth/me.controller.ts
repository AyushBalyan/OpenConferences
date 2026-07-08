import { Controller, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { authContract } from '@openconferences/contracts';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from './auth.types';
import { AuthService } from './auth.service';
import { MeDashboardService } from './me-dashboard.service';

@Controller()
export class MeController {
  constructor(
    private readonly authService: AuthService,
    private readonly meDashboard: MeDashboardService,
  ) {}

  @TsRestHandler(authContract.me)
  @UseGuards(AuthGuard)
  getMe(@CurrentUser() user: AuthUser | undefined) {
    return tsRestHandler(authContract.me, async () => {
      if (!user) {
        throw new UnauthorizedException('Authentication required');
      }

      const accountProfile = await this.authService.getAccountProfile(user);

      return {
        status: 200 as const,
        body: {
          id: user.id,
          email: user.email,
          name: user.name,
          emailVerified: user.emailVerified,
          image: user.image ?? null,
          twoFactorEnabled: user.twoFactorEnabled ?? null,
          createdAt: user.createdAt.toISOString(),
          hasPassword: accountProfile.hasPassword,
          needsProfileSetup: accountProfile.needsProfileSetup,
        },
      };
    });
  }

  @TsRestHandler(authContract.setupAccount)
  @UseGuards(AuthGuard)
  setupAccount(@Req() req: Request, @CurrentUser() user: AuthUser | undefined) {
    return tsRestHandler(authContract.setupAccount, async ({ body }) => {
      if (!user) {
        throw new UnauthorizedException('Authentication required');
      }

      await this.authService.setupAccount(req.headers, {
        name: body.name,
        newPassword: body.password,
      });

      return {
        status: 200 as const,
        body: { message: 'Account profile updated' },
      };
    });
  }

  @TsRestHandler(authContract.dashboard)
  @UseGuards(AuthGuard)
  getDashboard(@CurrentUser() user: AuthUser | undefined) {
    return tsRestHandler(authContract.dashboard, async () => {
      if (!user) {
        throw new UnauthorizedException('Authentication required');
      }

      const dashboard = await this.meDashboard.getDashboard(user.id);
      return { status: 200 as const, body: dashboard };
    });
  }
}
