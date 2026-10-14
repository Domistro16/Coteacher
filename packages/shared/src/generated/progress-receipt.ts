/* Generated from schemas/progress-receipt.schema.json. Do not edit; run npm run generate:types. */

export interface ProgressReceipt {
  schemaVersion: "1.0.0";
  studentId: string;
  lessonId: string;
  recordingId: string;
  sha256: string;
  acceptedAt: string;
  simulated: true;
}
