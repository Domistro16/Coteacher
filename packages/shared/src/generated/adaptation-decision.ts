/* Generated from schemas/adaptation-decision.schema.json. Do not edit; run npm run generate:types. */

export interface AdaptationDecision {
  schemaVersion: "1.0.0";
  learnerId: string;
  lessonId: string;
  conceptId: string;
  visualAssetId: string;
  reason: string;
  basis: "explicit-choice" | "observed" | "signup" | "default";
  /**
   * @maxItems 100
   */
  evidenceIds: string[];
  /**
   * @minItems 1
   * @maxItems 20
   */
  sourceRefs: string[];
}
