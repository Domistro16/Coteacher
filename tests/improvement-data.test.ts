import {afterEach,describe,it,expect,vi} from 'vitest';
import {validTrainingEvent,improvementDataAvailability,improvementDataNoticeVersion,type ImprovementTrainingEvent} from '../packages/shared/src/improvement-data';
import {initialLearnerProfile,optionalAllowed} from '../packages/shared/src/learner-profile';
const school='11111111-1111-4111-8111-111111111111';
const event=():ImprovementTrainingEvent=>({schemaVersion:'1.0.0',simulated:true,kind:'check-answered',schoolId:school,learnerKey:'a'.repeat(64),eventKey:'b'.repeat(64),conceptKey:'c'.repeat(64),assessmentKey:'assessed-content-v2:0123456789abcdef',occurredOn:'2026-11-02',attempt:1,correct:true});
afterEach(()=>vi.unstubAllEnvs());
describe('disabled improvement-data contract',()=>{
  it('validates a minimal scoped outcome and bounded approved context',()=>{
    expect(validTrainingEvent(event(),school)).toBe(true);
    expect(validTrainingEvent({...event(),classLevelBand:'junior-secondary',languageCode:'en',connectivity:'offline'},school)).toBe(true);
    expect(validTrainingEvent(event(),'22222222-2222-4222-8222-222222222222')).toBe(false);
  });
  it.each(['question','questionText','audio','audioBase64','name','email','answers','questionnaireAnswers','profile','accountId','studentId','timestamp','predictions','features'])('rejects the non-allowlisted field %s',key=>{
    expect(validTrainingEvent({...event(),[key]:'forbidden'},school)).toBe(false);
  });
  it('rejects missing versions, real-data markers, raw identities, invalid dates and unbounded outcomes',()=>{
    for(const change of [{schemaVersion:'2.0.0'},{simulated:false},{learnerKey:'student-private-id'},{occurredOn:'2026-02-30'},{attempt:0},{attempt:1001},{correct:'yes'},{assessmentKey:'raw question text'},{languageCode:'a learner name'}])expect(validTrainingEvent({...event(),...change},school)).toBe(false);
  });
  it('cannot enable collection, features or export through consent or environment flags',()=>{
    vi.stubEnv('COTEACHER_IMPROVEMENT_COLLECTION','true');vi.stubEnv('COTEACHER_IMPROVEMENT_EXPORT','true');
    expect(improvementDataAvailability).toEqual({collectionEnabled:false,featureProductionEnabled:false,exportEnabled:false});expect(Object.isFrozen(improvementDataAvailability)).toBe(true);
    const p=initialLearnerProfile('fictional','2026-11-02T00:00:00Z');p.ageBand='adult';p.permissions.essential=true;p.permissions.improvementData=true;
    expect(optionalAllowed(p,'improvementData')).toBe(false);p.improvementNoticeVersion=improvementDataNoticeVersion;expect(optionalAllowed(p,'improvementData')).toBe(true);
    expect(improvementDataAvailability.collectionEnabled).toBe(false);
  });
});
