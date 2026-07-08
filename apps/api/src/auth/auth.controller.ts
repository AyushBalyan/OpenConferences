import { All, Controller, HttpException, HttpStatus, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { toNodeHandler } from 'better-auth/node';
import { AuthService } from './auth.service';
import { LockoutService } from './lockout.service';
import { AuditService } from '../audit/audit.service';
import { TurnstileService } from '../turnstile/turnstile.service';

@Controller('auth')
export class AuthController {
  private readonly nodeHandler: ReturnType<typeof toNodeHandler>;

  constructor(
    private readonly authService: AuthService,
    private readonly lockout: LockoutService,
    private readonly audit: AuditService,
    private readonly turnstile: TurnstileService,
  ) {
    this.nodeHandler = toNodeHandler(this.authService.auth);
  }

  @All('*path')
  async handleBetterAuth(@Req() req: Request, @Res() res: Response): Promise<void> {
    const isSignUp = req.path.endsWith('/sign-up/email') && req.method === 'POST';
    const isSignIn = req.path.endsWith('/sign-in/email') && req.method === 'POST';
    const isMagicLinkRequest = req.path.endsWith('/sign-in/magic-link') && req.method === 'POST';
    const isMfa = req.path.includes('two-factor') && req.method === 'POST';
    let email: string | undefined;

    if (isMagicLinkRequest) {
      throw new HttpException(
        {
          type: 'https://errors.openconf.dev/forbidden',
          title: 'Forbidden',
          status: HttpStatus.FORBIDDEN,
          detail: 'Magic link sign-in is not available',
          instance: req.url,
        },
        HttpStatus.FORBIDDEN,
      );
    }

    if ((isSignUp || isSignIn) && this.turnstile.isEnabled()) {
      const token = this.turnstile.extractToken(req);
      const valid = token ? await this.turnstile.verify(token, req.ip) : false;
      if (!valid) {
        throw new HttpException(
          {
            type: 'https://errors.openconf.dev/forbidden',
            title: 'Forbidden',
            status: HttpStatus.FORBIDDEN,
            detail: 'Human verification failed. Please try again.',
            instance: req.url,
          },
          HttpStatus.FORBIDDEN,
        );
      }
    }

    if (isSignIn && req.body && typeof req.body === 'object' && 'email' in req.body) {
      email = String((req.body as { email: string }).email).toLowerCase();
      if (await this.lockout.isLocked(email)) {
        const retryAfter = await this.lockout.remainingSeconds(email);
        res.setHeader('Retry-After', String(retryAfter > 0 ? retryAfter : 900));
        throw new HttpException(
          {
            type: 'https://errors.openconf.dev/too-many-requests',
            title: 'Too Many Requests',
            status: HttpStatus.TOO_MANY_REQUESTS,
            detail: 'Account temporarily locked due to too many failed attempts',
            instance: req.url,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    res.on('finish', () => {
      void this.handleAfterAuth(req, res, isSignIn, isMfa, email);
    });

    await this.nodeHandler(req, res);
  }

  private async handleAfterAuth(
    req: Request,
    res: Response,
    isSignIn: boolean,
    isMfa: boolean,
    email?: string,
  ): Promise<void> {
    if (isSignIn && email) {
      if (res.statusCode >= 400) {
        await this.lockout.recordFailure(email);
        await this.audit.log({
          action: 'auth.login_failed',
          entity: 'user',
          diff: { email },
        });
      } else {
        await this.lockout.reset(email);
      }
    }

    if (isMfa && res.statusCode < 400) {
      const session = await this.authService.getSession(req.headers);
      const userId = session?.user.id;
      if (userId) {
        if (req.path.includes('enable')) {
          await this.audit.log({
            actorUserId: userId,
            action: 'auth.mfa_enrolled',
            entity: 'user',
            entityId: userId,
          });
        }
        if (req.path.includes('verify')) {
          await this.audit.log({
            actorUserId: userId,
            action: 'auth.mfa_verified',
            entity: 'user',
            entityId: userId,
          });
        }
      }
    }
  }
}
