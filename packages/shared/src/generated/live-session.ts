/* Generated from schemas/live-session.schema.json. Do not edit; run npm run generate:types. */

export interface LiveSessionRequest {
  enabled: true;
  sdp: string;
  positionMs: number;
}
