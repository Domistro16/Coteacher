/* Generated from schemas/player-state.schema.json. Do not edit; run npm run generate:types. */

export interface PlayerState {
  timelineIndex: number;
  variantId: string;
  activity: null | {
    phase: "intro" | "steps" | "why";
    instructionIndex: number;
  };
}
