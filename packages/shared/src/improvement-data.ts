import Ajv from 'ajv/dist/2020.js';
import schema from '../../../schemas/training-event.schema.json' with {type:'json'};
import type {ImprovementTrainingEvent} from './generated/training-event';
export type {ImprovementTrainingEvent};
export const improvementDataNoticeVersion='fictional-improvement-v1';
/** Deliberate fixed gates. Consent does not start collection, features or exports. */
export const improvementDataAvailability=Object.freeze({collectionEnabled:false,featureProductionEnabled:false,exportEnabled:false} as const);
const shape=new Ajv({strict:true}).compile<ImprovementTrainingEvent>(schema);
/** Tenant-bound structural validation, not semantic anonymization or a collector. */
export function validTrainingEvent(value:unknown,schoolId:string):value is ImprovementTrainingEvent {
  if(!shape(value) || value.schoolId!==schoolId)return false;
  const at=Date.parse(value.occurredOn+'T00:00:00.000Z');
  return Number.isFinite(at) && new Date(at).toISOString().slice(0,10)===value.occurredOn;
}
