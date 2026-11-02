/* Generated from schemas/student-decision.schema.json. Do not edit; run npm run generate:types. */

export interface StudentDecision {
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
      "none" | "personalization-off" | "cold-start" | "insufficient-evidence" | "model-unavailable" | "invalid-output";
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
}
