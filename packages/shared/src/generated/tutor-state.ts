/* Generated from schemas/tutor-state.schema.json. Do not edit; run npm run generate:types. */

export interface TutorState {
  enabled: boolean;
  studentId: string;
  lessonId: string;
  recordingId: string;
  /**
   * @maxItems 100
   */
  replies: TutorReply[];
  memory: LearnerMemory;
  /**
   * @maxItems 200
   */
  liveTurns?: LiveTutorTurn[];
  /**
   * @maxItems 40
   */
  checks?: TutorCheck[];
  /**
   * @maxItems 200
   */
  checkAttempts?: TutorCheckAttempt[];
}
export interface TutorReply {
  questionId: string;
  originalText: string;
  conceptId: string;
  timelineStepId: string;
  positionMs: number;
  status: "queued" | "answered" | "deferred" | "failed";
  text: string;
  /**
   * @maxItems 6
   */
  citations:
    | []
    | [TutorCitation]
    | [TutorCitation, TutorCitation]
    | [TutorCitation, TutorCitation, TutorCitation]
    | [TutorCitation, TutorCitation, TutorCitation, TutorCitation]
    | [TutorCitation, TutorCitation, TutorCitation, TutorCitation, TutorCitation]
    | [TutorCitation, TutorCitation, TutorCitation, TutorCitation, TutorCitation, TutorCitation];
  sourceRefs: string[];
  visualAssetId: string | null;
  engine: "openai" | "mock" | "unavailable";
  model: string;
  updatedAt: string;
  speechBase64: string | null;
  review: "unreviewed" | "flagged";
}
export interface TutorCitation {
  sourceId: string;
  title: string;
  locator: string;
  excerpt: string;
  kind: "lesson" | "curated";
}
export interface LearnerMemory {
  revision: number;
  /**
   * @maxItems 1000
   */
  observations: {
    eventId: string;
    conceptId: string;
    kind: string;
    detail: string;
  }[];
  /**
   * @maxItems 20
   */
  recommendations:
    | []
    | [
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        }
      ]
    | [
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        }
      ]
    | [
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        }
      ]
    | [
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        }
      ]
    | [
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        }
      ]
    | [
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        }
      ]
    | [
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        }
      ]
    | [
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        }
      ]
    | [
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        }
      ]
    | [
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        }
      ]
    | [
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        }
      ]
    | [
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        }
      ]
    | [
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        }
      ]
    | [
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        }
      ]
    | [
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        }
      ]
    | [
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        }
      ]
    | [
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        }
      ]
    | [
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        }
      ]
    | [
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        }
      ]
    | [
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        },
        {
          conceptId: string;
          visualAssetId: string;
          reason: string;
          evidenceEventIds: string[];
        }
      ];
}
export interface LiveTutorTurn {
  id: string;
  sessionId: string;
  conceptId: string;
  positionMs: number;
  role: "student" | "avatar";
  text: string;
  /**
   * @maxItems 6
   */
  sourceRefs:
    | []
    | [string]
    | [string, string]
    | [string, string, string]
    | [string, string, string, string]
    | [string, string, string, string, string]
    | [string, string, string, string, string, string];
  model: string;
  observedAt: string;
}
export interface TutorCheck {
  id: string;
  questionId: string;
  originalText: string;
  conceptId: string;
  timelineStepId: string;
  positionMs: number;
  prompt: string;
  /**
   * @minItems 2
   * @maxItems 4
   */
  options: [string, string] | [string, string, string] | [string, string, string, string];
  correctIndex: number;
  explanation: string;
  /**
   * @minItems 1
   * @maxItems 6
   */
  sourceRefs:
    | [string]
    | [string, string]
    | [string, string, string]
    | [string, string, string, string]
    | [string, string, string, string, string]
    | [string, string, string, string, string, string];
  /**
   * @minItems 1
   * @maxItems 6
   */
  citations:
    | [TutorCitation]
    | [TutorCitation, TutorCitation]
    | [TutorCitation, TutorCitation, TutorCitation]
    | [TutorCitation, TutorCitation, TutorCitation, TutorCitation]
    | [TutorCitation, TutorCitation, TutorCitation, TutorCitation, TutorCitation]
    | [TutorCitation, TutorCitation, TutorCitation, TutorCitation, TutorCitation, TutorCitation];
  personalization: CheckPersonalization;
  engine: "openai" | "mock";
  model: string;
  createdAt: string;
  speechBase64?: string | null;
}
export interface CheckPersonalization {
  mode: "guided" | "standard" | "application";
  reason: string;
  /**
   * @maxItems 10
   */
  evidenceEventIds:
    | []
    | [string]
    | [string, string]
    | [string, string, string]
    | [string, string, string, string]
    | [string, string, string, string, string]
    | [string, string, string, string, string, string]
    | [string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string, string, string];
  visualAssetId: string | null;
}
export interface TutorCheckAttempt {
  id: string;
  checkId: string;
  selectedIndex: number;
  correctness: boolean;
  answeredAt: string;
}
