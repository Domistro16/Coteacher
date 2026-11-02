/* Generated from schemas/school-state.schema.json. Do not edit; run npm run generate:types. */

export interface SchoolState {
  schemaVersion: "1.0.0";
  accounts: Account[];
  schools: School[];
  memberships: Membership[];
  sessions: Session[];
  groups: Group[];
  subjects: Subject[];
  offerings: Offering[];
  assignments: Assignment[];
  placements: Placement[];
  enrollments: Enrollment[];
  invitations: Invitation[];
  audits: Audit[];
  credentials: {
    accountId: string;
    salt: string;
    digest: string;
    mustChange: boolean;
  }[];
  policies: {
    id: string;
    schoolId: string;
    level: string;
    min: number;
    max: number;
  }[];
  publications: {
    id: string;
    schoolId: string;
    teacherId: string;
    offeringId: string;
    recordingId: string;
    external: boolean;
    reviewed: boolean;
  }[];
  identities: {
    accountId: string;
    providerId: string;
  }[];
  loginSessions: {
    tokenHash: string;
    accountId: string;
    expiresAt: string;
  }[];
  lessons: {
    id: string;
    schoolId: string;
    offeringId: string;
    teacherId: string;
    recordingId: string;
    title: string;
    templateKey: string;
    audioKey: string;
    sha256: string;
    byteLength: number;
    publishedAt: string;
    archived: boolean;
  }[];
  learningRecords: {
    id: string;
    schoolId: string;
    lessonId: string;
    studentId: string;
    objectKey: string;
    digest: string;
    updatedAt: string;
  }[];
  consents: {
    id: string;
    accountId: string;
    guardianEmail: string;
    kind: "guardian" | "school-authorized" | "external-ai" | "local-ai" | "adult-self";
    acceptedAt: string;
    withdrawn: boolean;
  }[];
  uploads: {
    id: string;
    schoolId: string;
    teacherId: string;
    offeringId: string;
    objectKey: string;
    sha256: string;
    byteLength: number;
    expiresAt: string;
    used: boolean;
  }[];
  tutorRecords: {
    id: string;
    schoolId: string;
    lessonId: string;
    studentId: string;
    objectKey: string;
    updatedAt: string;
  }[];
  retiredObjects: {
    key: string;
    deleteAfter: string;
  }[];
  privateLearners: {
    accountId: string;
    envelope: {
      algorithm: "aes-256-gcm-server-v1";
      iv: string;
      tag: string;
      ciphertext: string;
    };
    memoryEnvelope?: {
      algorithm: "aes-256-gcm-server-v1";
      iv: string;
      tag: string;
      ciphertext: string;
    };
    /**
     * Purpose-specific exclusion. Withdrawal and backup restore set this marker; only renewed explicit permission may clear it.
     */
    improvementExcludedAt?: string;
    /**
     * Reserved encrypted improvement-purpose derived features. No producer is enabled; withdrawal/restore remove this slot.
     */
    improvementFeaturesEnvelope?: {
      algorithm: "aes-256-gcm-server-v1";
      iv: string;
      tag: string;
      ciphertext: string;
    };
    /**
     * Only this newly created guardian request can lift an active improvement exclusion. Withdrawal and restore remove the authorization.
     */
    improvementAuthorizationRequestId?: string;
  }[];
  preparedSupport: {
    publicationId: string;
    data: {
      schemaVersion: "1.0.0";
      schoolId: string;
      lessonId: string;
      lessonRevision: string;
      sourceRevision: string;
      language: string;
      configuration: string;
      status: "draft" | "approved";
      reviewedAt?: string;
      /**
       * @maxItems 100
       */
      candidates: {
        id: string;
        conceptId: string;
        question: string;
        answer: string;
        /**
         * @minItems 1
         * @maxItems 20
         */
        sourceRefs: string[];
        rank: number;
        misconception: boolean;
        origin?: "reviewed" | "generated";
        /**
         * @minItems 1
         * @maxItems 6
         */
        quotes?: {
          sourceRef: string;
          variantId: string;
          quote: string;
        }[];
      }[];
      /**
       * @maxItems 100
       */
      explanations: {
        id: string;
        conceptId: string;
        text: string;
        /**
         * @minItems 1
         * @maxItems 20
         */
        sourceRefs: string[];
        origin?: "reviewed" | "generated";
        /**
         * @minItems 1
         * @maxItems 6
         */
        quotes?: {
          sourceRef: string;
          variantId: string;
          quote: string;
        }[];
      }[];
      knowledge: {
        schemaVersion: "1.0.0";
        schoolId: string;
        subjectKey: string;
        lessonId: string;
        lessonRevision: string;
        sourceRevision: string;
        language: string;
        configuration: string;
        reviewedAt: string;
        /**
         * @maxItems 50
         */
        concepts: {
          conceptId: string;
          knowledgeKey: string;
          /**
           * @maxItems 10
           */
          prerequisites: string[];
          /**
           * @minItems 1
           * @maxItems 20
           */
          sourceRefs: string[];
        }[];
      };
    };
  }[];
  placementRequests: {
    id: string;
    studentId: string;
    schoolId: string;
    classLevel: string;
    /**
     * @maxItems 15
     */
    subjects: string[];
    status: "pending" | "reviewed";
    createdAt: string;
  }[];
}
export interface Account {
  id: string;
  name: string;
  role: "owner" | "teacher" | "student" | "operator";
  email: string;
  verified: boolean;
  simulated: boolean;
  guardianEmail: string;
}
export interface School {
  id: string;
  name: string;
  location: string;
  contact: string;
  evidence: string;
  status: "pending" | "active" | "rejected" | "suspended";
  reason: string;
  levels: string[];
}
export interface Membership {
  id: string;
  schoolId: string;
  accountId: string;
  role: "owner" | "admin" | "teacher" | "student";
  status: "pending" | "active" | "rejected" | "suspended" | "ended";
}
export interface Session {
  id: string;
  schoolId: string;
  name: string;
  archived: boolean;
}
export interface Group {
  id: string;
  schoolId: string;
  sessionId: string;
  level: string;
  name: string;
  min: number;
  max: number;
  archived: boolean;
}
export interface Subject {
  id: string;
  schoolId: string;
  name: string;
  archived: boolean;
}
export interface Offering {
  id: string;
  schoolId: string;
  groupId: string;
  subjectId: string;
  compulsory: boolean;
  archived: boolean;
}
export interface Assignment {
  id: string;
  schoolId: string;
  offeringId: string;
  teacherId: string;
  archived: boolean;
}
export interface Placement {
  id: string;
  schoolId: string;
  studentId: string;
  groupId: string;
  active: boolean;
}
export interface Enrollment {
  id: string;
  schoolId: string;
  studentId: string;
  groupId: string;
  offeringIds: string[];
  status: "pending" | "approved" | "rejected" | "superseded";
  needsReview: boolean;
}
export interface Invitation {
  id: string;
  schoolId: string;
  email: string;
  role: "teacher" | "student" | "admin";
  tokenHash: string;
  expiresAt: string;
  accepted: boolean;
}
export interface Audit {
  id: string;
  actorId: string;
  schoolId: string;
  action: string;
  entityId: string;
  at: string;
}
