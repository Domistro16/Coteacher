import Ajv from 'ajv/dist/2020.js';
import inputSchema from '../../../schemas/student-model-input.schema.json' with { type: 'json' };
import outputSchema from '../../../schemas/student-model-output.schema.json' with { type: 'json' };
import decisionSchema from '../../../schemas/student-decision.schema.json' with { type: 'json' };
import type { StudentModelInput } from './generated/student-model-input';
import type { StudentModelOutput } from './generated/student-model-output';
import type { StudentDecision } from './generated/student-decision';

export type { StudentModelInput, StudentModelOutput, StudentDecision };

/** Synchronous and network-free: a replacement must preserve this caller contract. */
export interface StudentModel {
  readonly version: string;
  evaluate(input: Readonly<StudentModelInput>): StudentModelOutput;
}

const ajv = new Ajv({ strict: true });
export const validStudentModelInput = ajv.compile<StudentModelInput>(inputSchema);
export const validStudentModelOutput = ajv.compile<StudentModelOutput>(outputSchema);
export const validStudentDecision = ajv.compile<StudentDecision>(decisionSchema);
export const minimumPredictionConfidence = 0.5;

function eligibleAssessments(input: StudentModelInput) {
  const seenItems = new Set<string>(), seenEvents = new Set<string>();
  return [...input.assessments].filter(a => a.subjectKey === input.subjectKey && a.knowledgeKey === input.knowledgeKey &&
    Number.isFinite(Date.parse(a.at)) && Date.parse(a.at) <= Date.parse(input.asOf))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at)).filter(a => {
      if (seenItems.has(a.assessmentKey) || seenEvents.has(a.evidenceId)) return false;
      seenItems.add(a.assessmentKey); seenEvents.add(a.evidenceId); return true;
    });
}

function abstention(version: string, reason: Exclude<StudentModelOutput['abstainReason'], 'none'>): StudentModelOutput {
  return { schemaVersion: '1.0.0', modelVersion: version, status: 'abstain', understanding: 0.5, nextCheckProbability: 0.5,
    confidence: 0, confidenceKind: 'evidence-adequacy', estimateKind: 'response-evidence-proxy', calibration: 'unvalidated',
    sampleCount: 0, correctCount: 0, evidenceIds: [], abstainReason: reason,
    explanation: reason === 'personalization-off' ? 'Personalization is off. Use approved default support or your explicit choice.'
      : 'There is no usable student-model estimate. Use approved support; this does not assess mastery.' };
}

/** Beta(1,1) plus distinct first attempts. No fitting, pooled data or questionnaire inputs. */
export const bayesianEvidenceBaseline: StudentModel = {
  version: 'bayesian-evidence-count-v1',
  evaluate(input) {
    if (!input.personalization) return abstention(this.version, 'personalization-off');
    const evidence = eligibleAssessments(input), n = evidence.length;
    const correct = evidence.filter(a => a.correct).length;
    const mean = (1 + correct) / (2 + n), confidence = n / (n + 10);
    const status = confidence < minimumPredictionConfidence ? 'abstain' : 'estimate';
    return { schemaVersion: '1.0.0', modelVersion: this.version, status, understanding: mean, nextCheckProbability: mean,
      confidence, confidenceKind: 'evidence-adequacy', estimateKind: 'response-evidence-proxy', calibration: 'unvalidated',
      sampleCount: n, correctCount: correct, evidenceIds: evidence.map(a => a.evidenceId),
      abstainReason: n === 0 ? 'cold-start' : status === 'abstain' ? 'insufficient-evidence' : 'none',
      explanation: `${correct} of ${n} distinct first checks on this mapped concept were correct. A neutral starting count gives a response-based estimate; it does not separate understanding, guessing or check difficulty. ` +
        (status === 'abstain' ? 'Evidence is limited, so this estimate will not change support.' : 'The estimate can suggest approved support; your explicit choice still wins.') };
  },
};

/** Bad/unavailable replacements abstain. Invalid caller contracts fail before dispatch. */
export function evaluateStudentModel(input: StudentModelInput, model: StudentModel = bayesianEvidenceBaseline): StudentModelOutput {
  if (!validStudentModelInput(input) || !Number.isFinite(Date.parse(input.asOf))) throw new Error('Invalid student-model input.');
  if (!input.personalization) return abstention(model.version, 'personalization-off');
  try {
    const result = model.evaluate(structuredClone(input));
    const allowed = new Set(eligibleAssessments(input).map(a => a.evidenceId));
    if (!validStudentModelOutput(result) || result.modelVersion !== model.version || result.correctCount > result.sampleCount ||
      result.evidenceIds.length !== result.sampleCount || result.evidenceIds.some(id => !allowed.has(id)) ||
      result.status === 'estimate' && (result.confidence < minimumPredictionConfidence || result.abstainReason !== 'none') ||
      result.status === 'abstain' && result.abstainReason === 'none') return abstention(model.version, 'invalid-output');
    return result;
  } catch { return abstention(model.version, 'model-unavailable'); }
}
