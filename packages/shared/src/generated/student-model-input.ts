/* Generated from schemas/student-model-input.schema.json. Do not edit; run npm run generate:types. */

export interface StudentModelInput {
  schemaVersion: "1.0.0";
  learnerId: string;
  schoolId: string;
  subjectKey: string;
  knowledgeKey: string;
  conceptId: string;
  lessonId: string;
  lessonRevision: string;
  asOf: string;
  personalization: boolean;
  simulated: true;
  /**
   * @maxItems 1000
   */
  assessments: {
    evidenceId: string;
    assessmentKey: string;
    subjectKey: string;
    knowledgeKey: string;
    at: string;
    correct: boolean;
  }[];
}
