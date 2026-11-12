// Fields our middleware attaches to Express requests (used by `npm run typecheck`).
import type { HydratedDocument } from 'mongoose';

declare global {
  namespace Express {
    interface Request {
      /** Set by the request-id middleware in app.js. */
      requestId?: string;
      /** Authenticated Core Team user (authMiddleware). */
      user?: HydratedDocument<any>;
      /** Verified form participant (formParticipantMiddleware). */
      participant?: HydratedDocument<any>;
      participantVerification?: { sub: string; method: 'GOOGLE' | 'EMAIL_OTP'; verifiedAt: string };
      submissionForm?: HydratedDocument<any>;
      submissionSaved?: boolean;
    }
  }
}

export {};
