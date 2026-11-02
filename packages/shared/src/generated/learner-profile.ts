/* Generated from schemas/learner-profile.schema.json. Do not edit; run npm run generate:types. */

export interface LearnerProfile {
  schemaVersion: "1.0.0";
  accountId: string;
  simulated: true;
  revision: number;
  ageBand: "unknown" | "under-18" | "adult";
  step: number;
  complete: boolean;
  noticeVersion: string;
  updatedAt: string;
  permissions: {
    essential: boolean;
    personalization: boolean;
    externalAI: boolean;
  };
  answers: {
    preferredName?: string;
    classLevel?: string;
    /**
     * @maxItems 15
     */
    subjects?: string[];
    language?: string;
    readingEase?: "easy" | "ok" | "hard" | "not-sure";
    /**
     * @maxItems 2
     */
    formats?: ("picture" | "try-it" | "steps" | "example" | "hearing")[];
    length?: "short" | "detailed" | "depends" | "not-sure";
    medium?: "listening" | "reading" | "both" | "not-sure";
    confusion?: "teacher" | "friend" | "quiet" | "later" | "myself" | "not-sure";
    comfort?: number;
    input?: "speak" | "type" | "not-sure";
    /**
     * @maxItems 3
     */
    interests?: string[];
    aspiration?: string;
    favoriteSubject?: string;
    hardestSubject?: string;
    /**
     * @maxItems 15
     */
    confidence?: {
      subject: string;
      rating: number;
    }[];
    feedback?: "encouragement" | "direct" | "hints" | "not-sure";
    studyMinutes?: "under-15" | "15-30" | "30-60" | "over-60" | "not-sure";
    studyTime?: "morning" | "after-school" | "evening" | "weekends" | "not-sure";
    environment?: "quiet" | "noisy" | "not-sure";
    device?: "shared" | "own" | "not-sure";
    internet?: "wifi" | "limited" | "school-only" | "not-sure";
    largerText?: boolean;
    captions?: boolean;
    slowerAudio?: boolean;
    reducedMotion?: boolean;
    exam?: "class-tests" | "WAEC" | "NECO" | "JAMB" | "other" | "not-sure";
    goal?: "catch-up" | "understand" | "grade" | "not-sure";
  };
  /**
   * @maxItems 30
   */
  requests: {
    id: string;
    guardianEmail: string;
    tokenHash: string;
    createdAt: string;
    expiresAt: string;
    noticeVersion: string;
    scopes: {
      essential: boolean;
      personalization: boolean;
      externalAI: boolean;
    };
    status: "pending" | "verified" | "approved" | "rejected" | "withdrawn";
    schoolId?: string;
    verifiedAt?: string;
    authorityDeclared?: boolean;
    reviewedAt?: string;
    reviewerId?: string;
    reason?: string;
    deliveryMethod?: "simulated-link" | "email";
    verificationMethod?: "simulated-token" | "email-token";
  }[];
  withdrawnAt?: string;
  optionalClearedAt?: string;
}
