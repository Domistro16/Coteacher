/* Generated from schemas/lesson-package.schema.json. Do not edit; run npm run generate:types. */

export type Id = string;
export type Text = string;
export type StudentId = string;
/**
 * @minItems 1
 */
export type SourceRefs = [Id, ...Id[]];
export type Variant = ExplanationVariant | TryItVariant;
export type AssetPath = string;
export type Score = number;

export interface LessonPackage {
  schemaVersion: "1.0.0";
  lessonId: Id;
  title: Text;
  subject: Text;
  language: Text;
  simulated: boolean;
  studentId: StudentId;
  objective: {
    text: Text;
    /**
     * @minItems 1
     */
    conceptIds: [Id, ...Id[]];
  };
  /**
   * @minItems 1
   */
  sources: [Source, ...Source[]];
  /**
   * @minItems 1
   */
  concepts: [Concept, ...Concept[]];
  /**
   * @minItems 1
   */
  timeline: [TimelineStep, ...TimelineStep[]];
  /**
   * @minItems 0
   */
  questionBank: Question[];
  /**
   * @minItems 1
   */
  quiz: [QuizItem, ...QuizItem[]];
  route: {
    /**
     * @minItems 1
     */
    conceptOrder: [Id, ...Id[]];
    /**
     * @minItems 1
     */
    conceptRoutes: [
      {
        conceptId: Id;
        /**
         * @minItems 1
         */
        variantOrder: [Id, ...Id[]];
        reason: Text;
      },
      ...{
        conceptId: Id;
        /**
         * @minItems 1
         */
        variantOrder: [Id, ...Id[]];
        reason: Text;
      }[]
    ];
    /**
     * @minItems 0
     */
    insertedRefreshers: {
      conceptId: Id;
      variantId: Id;
      beforeConceptId: Id;
    }[];
  };
  matcher: {
    confidenceThreshold: Score;
    noMatchMessage: Text;
  };
}
export interface Source {
  id: Id;
  title: Text;
  kind: "notes" | "textbook" | "reference";
  citation: Text;
}
export interface Concept {
  id: Id;
  title: Text;
  /**
   * @minItems 0
   */
  prerequisiteConceptIds: Id[];
  /**
   * @minItems 0
   */
  misconceptions: Text[];
  sourceRefs: SourceRefs;
  /**
   * @minItems 2
   */
  variants: [Variant, Variant, ...Variant[]];
}
export interface ExplanationVariant {
  id: Id;
  type: "original" | "short" | "analogy" | "stepwise" | "refresher";
  content: Text;
  sourceRefs: SourceRefs;
  visualAssetPath?: AssetPath;
  audioAssetPath?: AssetPath;
}
export interface TryItVariant {
  id: Id;
  type: "tryit";
  content: Text;
  sourceRefs: SourceRefs;
  visualAssetPath?: AssetPath;
  audioAssetPath?: AssetPath;
  /**
   * @minItems 1
   */
  items: [Text, ...Text[]];
  /**
   * @minItems 1
   */
  steps: [Text, ...Text[]];
  explainsWhy: Text;
  /**
   * @minItems 1
   */
  safetyNotes: [Text, ...Text[]];
  returnToStep: Id;
}
export interface TimelineStep {
  id: Id;
  conceptId: Id;
  teacherSaid: Text;
  defaultVariantId: Id;
  sourceRefs: SourceRefs;
}
export interface Question {
  id: Id;
  question: Text;
  /**
   * @minItems 0
   */
  alternatePhrasings: Text[];
  answer: Text;
  conceptId: Id;
  timelineStepId: Id;
  sourceRefs: SourceRefs;
  audience: "class" | "student";
}
export interface QuizItem {
  id: Id;
  prompt: Text;
  /**
   * @minItems 2
   */
  options: [Text, Text, ...Text[]];
  correctIndex: number;
  explanation: Text;
  conceptId: Id;
  misconception: Text;
  sourceRefs: SourceRefs;
}
