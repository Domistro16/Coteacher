/* Generated from schemas/school-backup.schema.json. Do not edit; run npm run generate:types. */

export interface SchoolBackup {
  schemaVersion: "1.0.0";
  createdAt: string;
  stateJson: string;
  objects: {
    key: string;
    sha256: string;
    byteLength: number;
  }[];
}
