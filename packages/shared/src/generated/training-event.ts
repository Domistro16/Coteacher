/* Generated from schemas/training-event.schema.json. Do not edit; run npm run generate:types. */

/**
 * Allowlisted fictional improvement-event contract only. No collector, feature producer or export is enabled. Identifiers must be tenant-scoped pseudonyms; this shape alone is not an anonymity guarantee.
 */
export interface ImprovementTrainingEvent {
  schemaVersion: "1.0.0";
  simulated: true;
  kind: "check-answered";
  schoolId: string;
  /**
   * School-scoped keyed pseudonym, never an account ID, name or globally shared learner ID.
   */
  learnerKey: string;
  /**
   * School-scoped event pseudonym; not a raw progress event ID.
   */
  eventKey: string;
  /**
   * School-scoped reference to the approved concept mapping, not its title or question text.
   */
  conceptKey: string;
  assessmentKey: string;
  /**
   * UTC day only; no exact interaction timestamp.
   */
  occurredOn: string;
  attempt: number;
  correct: boolean;
  /**
   * Optional approved school-placement context; never copied from questionnaire answers.
   */
  classLevelBand?: "primary" | "junior-secondary" | "senior-secondary" | "unknown";
  /**
   * Optional approved lesson language code, not a learner questionnaire answer.
   */
  languageCode?: string;
  /**
   * Optional measured interaction context, not reported home connectivity.
   */
  connectivity?: "online" | "offline" | "unknown";
}
