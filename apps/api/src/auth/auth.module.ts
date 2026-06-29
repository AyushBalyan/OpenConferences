import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { MeController } from './me.controller';
import { AuthService } from './auth.service';
import { LockoutService } from './lockout.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { MembershipGuard } from '../common/guards/membership.guard';

@Module({
  controllers: [MeController, AuthController],
  providers: [AuthService, LockoutService, AuthGuard, MembershipGuard],
  exports: [AuthService, AuthGuard, MembershipGuard, LockoutService],
})
export class AuthModule {}
