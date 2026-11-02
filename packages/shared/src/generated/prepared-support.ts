/* Generated from schemas/prepared-support.schema.json. Do not edit; run npm run generate:types. */

export interface PreparedSupport {
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
}
