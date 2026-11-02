import Ajv from 'ajv/dist/2020.js';
import schema from '../../../schemas/learner-profile.schema.json' with { type: 'json' };
import type { LearnerProfile } from './generated/learner-profile';
import {improvementDataNoticeVersion} from './improvement-data';
export type { LearnerProfile } from './generated/learner-profile';
export const learningNoticeVersion = 'fictional-learning-v1';
const profileShape = new Ajv({ strict: true }).compile<LearnerProfile>(schema);
export function validLearnerProfile(value:unknown):value is LearnerProfile {
  return profileShape(value) && Number.isFinite(Date.parse(value.updatedAt)) && value.requests.every(r=>
    Date.parse(r.expiresAt)>Date.parse(r.createdAt) &&
    (!['verified','approved'].includes(r.status) || !!r.verifiedAt && Number.isFinite(Date.parse(r.verifiedAt)) && r.authorityDeclared===true && !!r.verificationMethod) &&
    (r.status!=='approved' || !!r.reviewedAt && Number.isFinite(Date.parse(r.reviewedAt)) && !!r.reviewerId && !!r.reason));
}
export function initialLearnerProfile(accountId: string, now: string): LearnerProfile {
  return { schemaVersion: '1.0.0', accountId, simulated: true, revision: 0, ageBand: 'unknown', step: 0, complete: false,
    noticeVersion: learningNoticeVersion, updatedAt: now, permissions: { essential: false, personalization: false, externalAI: false,improvementData:false }, answers: {}, requests: [] };
}
export function essentialReady(profile: LearnerProfile): boolean {
  return profile.permissions.essential && profile.ageBand !== 'unknown' &&
    (profile.ageBand === 'adult' || profile.requests.some(r => r.status === 'approved' && r.scopes.essential && r.noticeVersion === profile.noticeVersion));
}
export function optionalAllowed(profile: LearnerProfile, scope: 'personalization' | 'externalAI'|'improvementData'): boolean {
  return essentialReady(profile) && profile.permissions[scope]===true &&
    (scope!=='improvementData' || profile.improvementNoticeVersion===improvementDataNoticeVersion) && (profile.ageBand === 'adult' ||
    profile.requests.some(r => r.status === 'approved' && r.scopes[scope] && r.noticeVersion === profile.noticeVersion &&
      (scope!=='improvementData' || r.improvementNoticeVersion===improvementDataNoticeVersion)));
}
/** Explicit allowlist. Identity, guardian, comfort and precise routines never cross this boundary. */
export function teachingPreferences(profile: LearnerProfile, subject: string,target:'external'|'local'='external') {
  if (!optionalAllowed(profile, 'personalization') || target==='external' && !optionalAllowed(profile, 'externalAI')) return undefined;
  const a = profile.answers;
  return { formats: a.formats, length: a.length, readingEase: a.readingEase, medium: a.medium,
    interests: a.interests, feedback: a.feedback, confidence: a.confidence?.find(x => x.subject === subject)?.rating,
    studySupport: a.studyMinutes };
}
