/* Generated from schemas/progress-record.schema.json. Do not edit; run npm run generate:types. */

export type Id = string;
export type StudentId = string;
export type Timestamp = string;
export type Event =
  | NavigationEvent
  | VariantViewedEvent
  | TryItCompletedEvent
  | QuestionMatchedEvent
  | QuestionNoMatchEvent
  | QuizAnsweredEvent
  | TryItFollowUpEvent;
export type Score = number;
export type Text = string;
export type QueuedQuestion = UnansweredQuestion | AnsweredQuestion;
/**
 * @minItems 1
 */
export type SourceRefs = [Id, ...Id[]];

export interface ProgressRecord {
  schemaVersion: "1.0.0";
  lessonId: Id;
  studentId: StudentId;
  exportedAt: Timestamp;
  simulated: boolean;
  /**
   * @minItems 0
   */
  events: Event[];
  /**
   * @minItems 0
   */
  queuedQuestions: QueuedQuestion[];
}
export interface NavigationEvent {
  type: "pause" | "replay" | "explain-again";
  timestamp: Timestamp;
  timelineStepId: Id;
  conceptId: Id;
}
export interface VariantViewedEvent {
  type: "variant-viewed";
  timestamp: Timestamp;
  timelineStepId: Id;
  conceptId: Id;
  variantId: Id;
}
export interface TryItCompletedEvent {
  type: "tryit-completed";
  timestamp: Timestamp;
  timelineStepId: Id;
  conceptId: Id;
  variantId: Id;
}
export interface QuestionMatchedEvent {
  type: "question-matched";
  timestamp: Timestamp;
  timelineStepId: Id;
  conceptId: Id;
  questionId: Id;
  matcherScore: Score;
}
export interface QuestionNoMatchEvent {
  type: "question-no-match";
  timestamp: Timestamp;
  timelineStepId: Id;
  conceptId: Id;
  questionId: Id;
  matcherScore?: Score;
}
export interface QuizAnsweredEvent {
  type: "quiz-answered";
  timestamp: Timestamp;
  conceptId: Id;
  quizId: Id;
  correctness: boolean;
}
export interface TryItFollowUpEvent {
  type: "tryit-follow-up";
  timestamp: Timestamp;
  timelineStepId: Id;
  conceptId: Id;
  variantId: Id;
  text: Text;
  questionId?: Id;
}
export interface UnansweredQuestion {
  id: Id;
  text: Text;
  askedAt: Timestamp;
  timelineStepId: Id;
  answered: false;
}
export interface AnsweredQuestion {
  id: Id;
  text: Text;
  askedAt: Timestamp;
  timelineStepId: Id;
  answered: true;
  answer: Text;
  sourceRefs: SourceRefs;
}
