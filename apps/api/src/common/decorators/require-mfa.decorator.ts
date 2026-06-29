import { SetMetadata } from '@nestjs/common';
import { MFA_REQUIRED_KEY } from '../guards/guard.constants';

/** Require MFA for privileged mutations (§18.8). */
export const RequireMfa = () => SetMetadata(MFA_REQUIRED_KEY, true);
