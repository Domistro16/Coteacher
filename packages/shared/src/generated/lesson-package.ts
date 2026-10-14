/* Generated from schemas/lesson-package.schema.json. Do not edit; run npm run generate:types. */

export type Id = string;
export type Text = string;
export type Timestamp = string;
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
  topic: Text;
  classLevel: Text;
  /**
   * This sprint uses only the supplied manually reviewed demo instruction. Collection and publication reject altered instruction even when approval and source identifiers are structurally valid.
   */
  contentOrigin: "manually-prepared-demo";
  publication:
    | {
        status: "draft";
      }
    | {
        status: "approved";
        approvedAt: Timestamp;
        approvalKind: "teacher-review" | "seeded-demo";
      };
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
  classroomTimeline?: ClassroomTimeline;
  recording?: LessonRecording;
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
  /**
   * @minItems 1
   * @maxItems 20
   */
  visualAssets?:
    | [VisualAsset]
    | [VisualAsset, VisualAsset]
    | [VisualAsset, VisualAsset, VisualAsset]
    | [VisualAsset, VisualAsset, VisualAsset, VisualAsset]
    | [VisualAsset, VisualAsset, VisualAsset, VisualAsset, VisualAsset]
    | [VisualAsset, VisualAsset, VisualAsset, VisualAsset, VisualAsset, VisualAsset]
    | [VisualAsset, VisualAsset, VisualAsset, VisualAsset, VisualAsset, VisualAsset, VisualAsset]
    | [VisualAsset, VisualAsset, VisualAsset, VisualAsset, VisualAsset, VisualAsset, VisualAsset, VisualAsset]
    | [
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset
      ]
    | [
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset
      ]
    | [
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset
      ]
    | [
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset
      ]
    | [
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset
      ]
    | [
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset
      ]
    | [
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset
      ]
    | [
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset
      ]
    | [
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset
      ]
    | [
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset
      ]
    | [
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset
      ]
    | [
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset,
        VisualAsset
      ];
  playback?: {
    recordingId: Id;
    studentId: StudentId;
    simulated: true;
    method: "demo-history-rules-v1" | "prepared-support-rules-v2";
    catalogVersion: "refraction-visuals-v1";
    reason: string;
    /**
     * @minItems 1
     * @maxItems 1000
     */
    sequence: [
      {
        cueIndex: number;
        offsetMs: number;
        conceptId: Id;
        timelineStepId: Id;
        visualAssetId: Id;
        sourceRefs: SourceRefs;
      },
      ...{
        cueIndex: number;
        offsetMs: number;
        conceptId: Id;
        timelineStepId: Id;
        visualAssetId: Id;
        sourceRefs: SourceRefs;
      }[]
    ];
    decision?: {
      difficulty: "boundary-position" | "boundary-steps" | "insufficient-history";
      preference?: "concrete-diagrams" | "ordered-annotations";
      representation: "concrete-diagrams" | "ordered-annotations";
      basis: "simulated-history" | "learner-preference" | "default";
    };
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
export interface ClassroomTimeline {
  sessionId: Id;
  approvedAt: Timestamp;
  startedAt: Timestamp;
  currentStepId: Id;
  /**
   * @minItems 1
   */
  visits: [
    {
      timelineStepId: Id;
      conceptId: Id;
      presentedAt: Timestamp;
    },
    ...{
      timelineStepId: Id;
      conceptId: Id;
      presentedAt: Timestamp;
    }[]
  ];
}
export interface LessonRecording {
  id: Id;
  lessonId: Id;
  classroomSessionId: Id;
  lessonApprovedAt: Timestamp;
  startedAt: Timestamp;
  durationMs: number;
  origin: "teacher-microphone";
  audio:
    | {
        mimeType: "audio/wav";
        sampleRate: 16000;
        channels: 1;
        dataBase64: string;
        mediaKey?: string;
      }
    | {
        sampleRate: 16000 | 48000;
        channels: 1;
        mediaKey: string;
        mimeType: "audio/ogg;codecs=opus";
        dataBase64: string;
      }
    | {
        sampleRate: 16000 | 48000;
        channels: 1;
        mediaKey: string;
        mimeType: "audio/wav" | "audio/ogg;codecs=opus";
        mediaId: Id;
        byteLength: number;
      }
    | {
        sampleRate: 16000 | 48000;
        channels: 1;
        mediaKey: string;
        mimeType: "audio/wav" | "audio/ogg;codecs=opus";
        byteLength: number;
        mediaUrl: string;
        sha256: string;
      };
  /**
   * @minItems 1
   * @maxItems 1000
   */
  cues: [
    {
      offsetMs: number;
      timelineStepId: Id;
      conceptId: Id;
      sourceRefs: SourceRefs;
    },
    ...{
      offsetMs: number;
      timelineStepId: Id;
      conceptId: Id;
      sourceRefs: SourceRefs;
    }[]
  ];
  review:
    | {
        status: "draft";
      }
    | {
        status: "approved";
        reviewedAt: Timestamp;
      };
  visualReview?:
    | {
        status: "draft";
      }
    | {
        status: "approved";
        reviewedAt: Timestamp;
        catalogVersion: "refraction-visuals-v1";
      };
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
export interface VisualAsset {
  id: Id;
  conceptId: Id;
  title: string;
  sourceRefs: SourceRefs;
  /**
   * @minItems 1
   * @maxItems 40
   */
  layers: [VisualLayer, ...VisualLayer[]];
}
export interface VisualLayer {
  kind: "path" | "rect" | "circle" | "text";
  x: number;
  y: number;
  w: number;
  h: number;
  d: string;
  text: string;
  fill: string;
  stroke: string;
  emphasis: boolean;
}
