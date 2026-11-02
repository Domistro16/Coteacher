/* Generated from schemas/lesson-knowledge.schema.json. Do not edit; run npm run generate:types. */

export interface LessonKnowledge {
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
}
