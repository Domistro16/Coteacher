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
      confidence: number;
      confidenceKind: "evidence-adequacy" | "model-uncertainty";
      estimateKind: "response-evidence-proxy" | "model-estimate";
      calibration: "unvalidated" | "evaluated";
      sampleCount: number;
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
     * @maxItems 1000
     */
    evidenceIds: string[];
  }[];
}
