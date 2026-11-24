// Fields our middleware attaches to Express requests (used by `npm run typecheck`).
import type { HydratedDocument } from 'mongoose';

declare global {
  namespace Express {
    interface Request {
      /** Set by the request-id middleware in app.js. */
      requestId?: string;
      /** Limited by its own route limiter instead of the general one (middleware/rateLimits.js). */
      ownLimit?: boolean;
      /** Authenticated Core Team user (authMiddleware). */
      user?: HydratedDocument<any>;
      /** Verified form participant (formParticipantMiddleware). */
      participant?: HydratedDocument<any>;
      participantVerification?: { sub: string; method: 'GOOGLE' | 'EMAIL_OTP'; verifiedAt: string };
      submissionForm?: HydratedDocument<any>;
      submissionSaved?: boolean;
      /** Active juror behind a jury link (modules/jury jurorAuth). */
      juror?: HydratedDocument<any>;
      /** Signed team login, the key of the jury admin limit (modules/jury/middleware/limits.js). */
      staffKey?: string;
    }
  }
}

export {};
