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
  | TryItFollowUpEvent
  | VisualExploredEvent;
export type Score = number;
export type Text = string;
/**
 * @minItems 1
 */
export type SourceRefs = [Id, ...Id[]];
export type QueuedQuestion = UnansweredQuestion | AnsweredQuestion;

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
  eventId?: Id;
}
export interface VariantViewedEvent {
  type: "variant-viewed";
  timestamp: Timestamp;
  timelineStepId: Id;
  conceptId: Id;
  variantId: Id;
  eventId?: Id;
}
export interface TryItCompletedEvent {
  type: "tryit-completed";
  timestamp: Timestamp;
  timelineStepId: Id;
  conceptId: Id;
  variantId: Id;
  eventId?: Id;
}
export interface QuestionMatchedEvent {
  type: "question-matched";
  timestamp: Timestamp;
  timelineStepId: Id;
  conceptId: Id;
  questionId: Id;
  matcherScore: Score;
  recordedContext?: RecordedQuestionContext;
  originalText?: Text;
  eventId?: Id;
}
export interface RecordedQuestionContext {
  studentId: Id;
  lessonId: Id;
  conceptId: Id;
  recordingId: Id;
  positionMs: number;
}
export interface QuestionNoMatchEvent {
  type: "question-no-match";
  timestamp: Timestamp;
  timelineStepId: Id;
  conceptId: Id;
  questionId: Id;
  matcherScore?: Score;
  eventId?: Id;
}
export interface QuizAnsweredEvent {
  type: "quiz-answered";
  timestamp: Timestamp;
  conceptId: Id;
  quizId: Id;
  correctness: boolean;
  selectedIndex?: number;
  sourceRefs?: SourceRefs;
  eventId?: Id;
}
export interface TryItFollowUpEvent {
  type: "tryit-follow-up";
  timestamp: Timestamp;
  timelineStepId: Id;
  conceptId: Id;
  variantId: Id;
  text: Text;
  questionId?: Id;
  eventId?: Id;
}
export interface VisualExploredEvent {
  type: "visual-explored";
  /**
   * How this representation was shown. Missing on legacy events; never infer an explicit preference from missing or automatic origin.
   */
  origin?: "learner-choice" | "prepared-help" | "connected-help";
  timestamp: Timestamp;
  conceptId: string;
  timelineStepId: string;
  recordingId: string;
  visualAssetId: string;
  positionMs: number;
  sourceRefs: SourceRefs;
  eventId?: Id;
}
export interface UnansweredQuestion {
  id: Id;
  text: Text;
  askedAt: Timestamp;
  timelineStepId: Id;
  answered: false;
  recordedContext?: RecordedQuestionContext;
}
export interface AnsweredQuestion {
  id: Id;
  text: Text;
  askedAt: Timestamp;
  timelineStepId: Id;
  answered: true;
  answer: Text;
  sourceRefs: SourceRefs;
  recordedContext?: RecordedQuestionContext;
  answerOrigin?: "teacher-reviewed" | "simulated-prepared";
}
