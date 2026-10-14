/* Generated from schemas/progress-sync-state.schema.json. Do not edit; run npm run generate:types. */

export interface ProgressSyncState {
  receipt: {
    schemaVersion: "1.0.0";
    studentId: string;
    lessonId: string;
    recordingId: string;
    sha256: string;
    acceptedAt: string;
    simulated: true;
  };
  eventIds: string[];
  questionIds: string[];
}
