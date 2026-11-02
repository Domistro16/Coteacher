/* Generated from schemas/learner-memory.schema.json. Do not edit; run npm run generate:types. */

export interface PrivateLearnerMemory {
  schemaVersion: "1.0.0";
  learnerId: string;
  simulated: true;
  consentRevision: number;
  personalization: boolean;
  preferences: {
    readingEase?: "easy" | "ok" | "hard" | "not-sure";
    /**
     * @maxItems 2
     */
    formats?: ("picture" | "try-it" | "steps" | "example" | "hearing")[];
    length?: "short" | "detailed" | "depends" | "not-sure";
    medium?: "listening" | "reading" | "both" | "not-sure";
    largerText?: boolean;
    captions?: boolean;
    slowerAudio?: boolean;
    reducedMotion?: boolean;
    /**
     * @maxItems 15
     */
    confidence?: {
      subject: string;
      rating: number;
    }[];
    input?: "speak" | "type" | "not-sure";
    feedback?: "encouragement" | "direct" | "hints" | "not-sure";
  };
  /**
   * @maxItems 1000
   */
  evidence: {
    id: string;
    lessonId: string;
    subjectKey: string;
    knowledgeKey: string;
    at: string;
    kind: "assessment" | "help" | "choice";
    correct?: boolean;
    representation?: "picture" | "steps";
    /**
     * @minItems 1
     * @maxItems 20
     */
    sourceRefs: string[];
    /**
     * The assessed-content-v2 fingerprint sorts normalized options and identifies the correct answer by text. Order-sensitive v1 and absent keys remain rule evidence but are excluded from independent model assessment counts.
     */
    assessmentKey?: string;
  }[];
  /**
   * @maxItems 100
   */
  completedLessons: {
    lessonId: string;
    completedAt: string;
  }[];
  /**
   * @maxItems 3
   */
  promptedLessons: string[];
  clearedBefore?: string;
  /**
   * @maxItems 1000
   */
  decisions?: {
    schemaVersion: "1.0.0";
    id: string;
    /**
     * Identifier of the selection event; separate from supporting evidence identifiers.
     */
    selectionId: string;
    learnerId: string;
    lessonId: string;
    subjectKey: string;
    knowledgeKey: string;
    conceptId: string;
    selectedVisualId: string;
    basis: "explicit-choice" | "observed" | "signup" | "default";
    reason: string;
    at: string;
    simulated: true;
    model: {
      schemaVersion: "1.0.0";
      modelVersion: string;
      status: "estimate" | "abstain";
      understanding: number;
      nextCheckProbability: number;
      /**
       * Evidence-adequacy confidence is bounded by n/(n+10) for the cited distinct assessments. Estimates require at least ten cited assessments regardless of confidence kind.
       */
      confidence: number;
      confidenceKind: "evidence-adequacy" | "model-uncertainty";
      estimateKind: "response-evidence-proxy" | "model-estimate";
      calibration: "unvalidated" | "evaluated";
      sampleCount: number;
      /**
       * Number of correct outcomes among the cited eligible assessments, verified by the caller boundary.
       */
      correctCount: number;
      explanation: string;
      abstainReason:
        | "none"
        | "personalization-off"
        | "cold-start"
        | "insufficient-evidence"
        | "model-unavailable"
        | "invalid-output";
      /**
       * @maxItems 1000
       */
      evidenceIds: string[];
    };
    /**
     * @minItems 1
     * @maxItems 20
     */
    sourceRefs: string[];
    /**
     * Prior evidence supporting the actual selected visual. Excludes the selectionId and its lesson-qualified event ID; empty for a selection without an observed-evidence basis.
     *
     * @maxItems 1000
     */
    evidenceIds: string[];
  }[];
}
