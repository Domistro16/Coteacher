/* Generated from schemas/student-model-output.schema.json. Do not edit; run npm run generate:types. */

export interface StudentModelOutput {
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
    "none" | "personalization-off" | "cold-start" | "insufficient-evidence" | "model-unavailable" | "invalid-output";
  /**
   * @maxItems 1000
   */
  evidenceIds: string[];
}
