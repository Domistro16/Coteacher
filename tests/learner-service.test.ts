import { describe,it,expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import { checkSchoolState, emptySchoolState, restoreSchoolState, SchoolService } from '../delivery/school-store';
import { LearnerService } from '../delivery/learner-service';
import { schoolFixture } from './school-fixture';
import { teachingPreferences, initialLearnerProfile } from '../packages/shared/src/learner-profile';
import { ResendGuardianDelivery } from '../delivery/guardian-mail';
import {improvementDataNoticeVersion} from '../packages/shared/src/improvement-data';
import {sealServer} from '../delivery/server-encryption';
import {createHash} from 'node:crypto';

async function setup() {
  let state=emptySchoolState();
  const school=new SchoolService({async transaction(work){const next=structuredClone(state);const output=await work(next);checkSchoolState(next);state=next;return output;}});
  let now=new Date('2026-11-01T10:00:00Z');
  const secret=randomBytes(32).toString('hex');const learners=new LearnerService(school,secret,()=>now);
  const f=await schoolFixture(school);
  return {...f,school,learners,secret,state:()=>state,advance:()=>{now=new Date(now.getTime()+8*86400000);}};
}
const permissions={essential:true,personalization:true,externalAI:true};
const answers={preferredName:'Fictional learner',classLevel:'JSS2',subjects:['Science'],language:'English',readingEase:'ok',formats:['steps'],length:'short',medium:'both',confusion:'quiet',input:'type',comfort:1,interests:['football']};
describe('private onboarding and verified consent readiness (fictional records)',()=>{
  it('defaults improvement off and requires a separate current notice without inheriting personalization/external AI',async()=>{
    const f=await setup(),id=f.student.id;
    let p=await f.learners.update(id,{revision:0,ageBand:'adult',permissions,answers});
    expect(p.improvementDataAllowed).toBe(false);expect(p.permissions.improvementData).toBe(false);
    await expect(f.learners.update(id,{revision:p.revision,permissions:{...permissions,improvementData:true}})).rejects.toThrow('notice');
    p=await f.learners.update(id,{revision:p.revision,permissions:{...permissions,improvementData:true},improvementNoticeVersion:improvementDataNoticeVersion});
    expect(p.improvementDataAllowed).toBe(true);
    p=await f.learners.update(id,{revision:p.revision,permissions:{essential:true,personalization:false,externalAI:false}});
    expect(p.improvementDataAllowed).toBe(true);expect(p.personalizationAllowed).toBe(false);expect(p.externalAIAllowed).toBe(false);
    const status=await f.learners.improvementEligibility(id,f.group.schoolId);
    expect(status).toMatchObject({consentAllowed:true,eligibleForTraining:false,collectionEnabled:false,featureProductionEnabled:false,exportEnabled:false});
    expect((await f.learners.improvementEligibility(id,'another-school')).consentAllowed).toBe(false);
  });
  it('withdraws only improvement use and durably deletes its features while preserving private personalization',async()=>{
    const f=await setup(),id=f.student.id;
    let p=await f.learners.update(id,{revision:0,ageBand:'adult',permissions:{...permissions,improvementData:true},improvementNoticeVersion:improvementDataNoticeVersion,answers});
    await f.learners.learningContext(id);
    const memory=f.state().privateLearners[0].memoryEnvelope;
    await f.school.repository.transaction(s=>{s.privateLearners.find(r=>r.accountId===id)!.improvementFeaturesEnvelope=sealServer({conceptCounts:[1,2]},createHash('sha256').update('learner-profile-v1:'+f.secret).digest(),'learner-improvement-features-v1:'+id);});
    p=await f.learners.withdrawImprovement(id);
    expect(p.improvementDataAllowed).toBe(false);expect(p.answers).toEqual(answers);expect(p.personalizationAllowed).toBe(true);expect(p.externalAIAllowed).toBe(true);
    const row=f.state().privateLearners.find(r=>r.accountId===id)!;expect(row.improvementFeaturesEnvelope).toBeUndefined();expect(row.improvementExcludedAt).toBeTruthy();expect(row.memoryEnvelope).toEqual(memory);
    expect((await f.learners.improvementEligibility(id,f.group.schoolId)).consentAllowed).toBe(false);
    await expect(f.learners.update(id,{revision:p.revision,permissions:{...permissions,improvementData:true}})).rejects.toThrow('notice');
    expect((await f.learners.get(id)).permissions.improvementData).toBe(false);
    await expect(f.learners.withdrawImprovement(f.teacher.id)).rejects.toThrow('Student account');
  });
  it('requires a purpose-specific guardian declaration/review and cannot reuse it after withdrawal',async()=>{
    const f=await setup(),id=f.student.id;await f.learners.update(id,{revision:0,ageBand:'under-18'});
    const learning=await f.learners.requestGuardian(id,{email:'guardian@fictional.invalid',scopes:permissions});
    await f.learners.verifyGuardian({token:learning.verificationToken,authorityDeclared:true});
    await f.learners.review(f.owner.id,{studentId:id,id:learning.profile.requests[0].id,approved:true,reason:'Fictional learning review'});
    let p=await f.learners.get(id);p=await f.learners.update(id,{revision:p.revision,answers});const before=p.answers;
    expect(p.improvementDataAllowed).toBe(false);
    await expect(f.learners.update(id,{revision:p.revision,permissions:{...permissions,improvementData:true},improvementNoticeVersion:improvementDataNoticeVersion})).rejects.toThrow('Guardian');
    const request=await f.learners.requestGuardian(id,{purpose:'improvementData',email:'guardian@fictional.invalid',improvementNoticeVersion:improvementDataNoticeVersion,scopes:{essential:false,personalization:false,externalAI:false,improvementData:true}});
    expect(request.profile.essentialReady).toBe(true);expect(request.profile.personalizationAllowed).toBe(true);expect(request.profile.answers).toEqual(before);
    const review={studentId:id,id:request.profile.requests.at(-1)!.id,approved:true,reason:'Fictional improvement relationship review'};
    await expect(f.learners.review(f.owner.id,review)).rejects.toThrow('verified');
    await f.learners.verifyGuardian({token:request.verificationToken,authorityDeclared:true});
    await expect(f.learners.review(f.teacher.id,review)).rejects.toThrow('reviewer');await f.learners.review(f.owner.id,review);
    p=await f.learners.get(id);expect(p.improvementDataAllowed).toBe(true);expect(p.personalizationAllowed).toBe(true);expect(p.answers).toEqual(before);
    p=await f.learners.withdrawImprovement(id);expect(p.essentialReady).toBe(true);expect(p.improvementDataAllowed).toBe(false);
    await expect(f.learners.update(id,{revision:p.revision,permissions:{...permissions,improvementData:true},improvementNoticeVersion:improvementDataNoticeVersion})).rejects.toThrow('Guardian');
    expect((await f.learners.get(id)).improvementDataAllowed).toBe(false);
  });
  it('clears improvement features through the processing checkbox and full withdrawal paths too',async()=>{
    const f=await setup(),id=f.student.id;
    let p=await f.learners.update(id,{revision:0,ageBand:'adult',permissions:{...permissions,improvementData:true},improvementNoticeVersion:improvementDataNoticeVersion,answers});
    const seed=()=>f.school.repository.transaction(s=>{s.privateLearners.find(r=>r.accountId===id)!.improvementFeaturesEnvelope=sealServer({schoolId:f.group.schoolId,counts:[1]},createHash('sha256').update('learner-profile-v1:'+f.secret).digest(),'learner-improvement-features-v1:'+id);});
    await seed();p=await f.learners.update(id,{revision:p.revision,permissions:{...permissions,improvementData:false}});
    expect(p.personalizationAllowed).toBe(true);expect(p.answers).toEqual(answers);expect(f.state().privateLearners[0].improvementFeaturesEnvelope).toBeUndefined();
    p=await f.learners.update(id,{revision:p.revision,permissions:{...permissions,improvementData:true},improvementNoticeVersion:improvementDataNoticeVersion});
    await seed();p=await f.learners.withdraw(id);expect(p.improvementDataAllowed).toBe(false);expect(p.answers).toEqual({});expect(f.state().privateLearners[0].improvementFeaturesEnvelope).toBeUndefined();
  });
  it('shares only explicit placement-change requests and never grants class or subject access from preferences',async()=>{
    const f=await setup(),before=await f.school.snapshot(f.student.id);
    await f.school.command(f.student.id,'request-learning-placement',{schoolId:before.schools[0].id,classLevel:'SS1',subjects:['Physics']});
    const after=await f.school.snapshot(f.student.id);expect(after.placements).toEqual(before.placements);expect(after.enrollments).toEqual(before.enrollments);
    const request=(await f.school.snapshot(f.owner.id)).placementRequests[0];expect(request.classLevel).toBe('SS1');expect(Object.keys(request).sort()).toEqual(['classLevel','createdAt','id','schoolId','status','studentId','subjects']);
    await expect(f.school.command(f.teacher.id,'review-learning-placement',{schoolId:request.schoolId,id:request.id})).rejects.toThrow();
    await f.school.command(f.owner.id,'review-learning-placement',{schoolId:request.schoolId,id:request.id});
    expect((await f.school.snapshot(f.student.id)).placements).toEqual(before.placements);
  });
  it('hands verification to an explicit mail adapter without exposing the token to the learner and revokes failed delivery',async()=>{
    const f=await setup();await f.learners.update(f.student.id,{revision:0,ageBand:'under-18'});
    const deliveries:Parameters<import('../delivery/guardian-mail').GuardianDelivery['send']>[0][]=[];
    const mail={async send(input:typeof deliveries[number]){deliveries.push(input);}};
    const service=new LearnerService(f.school,f.secret,undefined,mail);
    const result=await service.requestGuardian(f.student.id,{email:'guardian@fictional.invalid',scopes:permissions});
    expect(result.verificationToken).toBeUndefined();expect(deliveries).toHaveLength(1);expect(deliveries[0].token).toHaveLength(64);
    expect(JSON.stringify(f.state())).not.toContain(deliveries[0].token);
    await service.verifyGuardian({token:deliveries[0].token,authorityDeclared:true});
    expect((await service.get(f.student.id)).requests.at(-1)?.verificationMethod).toBe('email-token');
    const failing=new LearnerService(f.school,f.secret,undefined,{async send(){throw new Error('mail unavailable');}});
    await expect(failing.requestGuardian(f.student.id,{email:'guardian@fictional.invalid',scopes:permissions})).rejects.toThrow('not accepted');
    expect((await f.learners.get(f.student.id)).requests.at(-1)?.status).toBe('withdrawn');
  });
  it('uses the official transactional email API only when injected and configured (mocked transport, no email sent)',async()=>{
    let payload:Record<string,unknown>|undefined;
    const request=(async(url,init)=>{expect(url).toBe('https://api.resend.com/emails');payload=JSON.parse(String(init?.body));return new Response('{}',{status:200});}) as typeof fetch;
    const adapter=new ResendGuardianDelivery('fictional-api-key','mail@fictional.invalid','https://student.fictional.invalid',request);
    await adapter.send({requestId:'fictional-request',email:'guardian@fictional.invalid',token:'a'.repeat(64),noticeVersion:'fictional-learning-v1',scopes:permissions});
    expect(payload?.to).toEqual(['guardian@fictional.invalid']);expect(payload?.text).toContain('https://student.fictional.invalid/#guardian=');
    expect(()=>new ResendGuardianDelivery('x','mail@fictional.invalid','http://localhost')).toThrow('HTTPS');
  });
  it('migrates existing accounts without inventing authorization',async()=>{
    const s=emptySchoolState();const legacy={...s} as Partial<typeof s>;delete legacy.privateLearners;
    expect(restoreSchoolState(legacy).privateLearners).toEqual([]);
    const f=await setup();const p=await f.learners.get(f.student.id);
    expect(p.essentialReady).toBe(false);expect(p.ageBand).toBe('unknown');expect(f.state().privateLearners).toEqual([]);
    expect(await f.learners.externalAllowed(f.student.id)).toBe(false);expect(await f.learners.externalAllowed(f.student.id,false)).toBe(false);
  });
  it('requires age before answers, essential authorization before questionnaire, and rejects unknown fields',async()=>{
    const f=await setup();const id=f.student.id;
    await expect(f.learners.update(id,{revision:0,answers})).rejects.toThrow('age question');
    const p=await f.learners.update(id,{revision:0,ageBand:'adult'});
    await expect(f.learners.update(id,{revision:p.revision,answers})).rejects.toThrow('authorization');
    await expect(f.learners.update(id,{revision:p.revision,guardianEmail:'leak'})).rejects.toThrow('Unknown');
  });
  it('encrypts drafts, survives reads, prevents lost updates, and excludes questionnaires from all snapshots',async()=>{
    const f=await setup();const id=f.student.id;
    const p=await f.learners.update(id,{revision:0,ageBand:'adult',permissions,answers,step:2});
    expect((await f.learners.get(id)).answers).toEqual(answers);
    expect(JSON.stringify(f.state().privateLearners)).not.toContain('football');
    for(const actor of [f.student.id,f.owner.id,f.teacher.id,f.outsider.id]) expect(JSON.stringify(await f.school.snapshot(actor))).not.toContain('football');
    await expect(f.learners.update(id,{revision:0,answers})).rejects.toThrow('Reload');
    await expect(f.learners.get(f.owner.id)).rejects.toThrow('Student account');
    expect((await f.learners.get(f.outsider.id)).answers).toEqual({});
    const broken=new LearnerService(f.school,'another-stable-fictional-key-123456789');
    await expect(broken.get(id)).rejects.toThrow();expect(p.step).toBe(2);
  });
  it('preserves basic learning with optional processing declined and removes optional answers',async()=>{
    const f=await setup();const id=f.student.id;
    let p=await f.learners.update(id,{revision:0,ageBand:'adult',permissions,answers});
    p=await f.learners.update(id,{revision:p.revision,permissions:{...permissions,personalization:false},complete:true});
    expect(p.complete).toBe(true);expect(p.answers).toEqual({});expect(p.personalizationAllowed).toBe(false);
    const snap=await f.school.snapshot(id);expect(snap.placements.some(x=>x.active)).toBe(true);
  });
  it('requires guardian verification and independent same-school review, never a legacy checkbox',async()=>{
    const f=await setup();const id=f.student.id;
    let p=await f.learners.update(id,{revision:0,ageBand:'under-18'});
    await expect(f.learners.update(id,{revision:p.revision,permissions})).rejects.toThrow('Guardian');
    const request=await f.learners.requestGuardian(id,{email:'guardian@fictional.invalid',scopes:permissions});
    expect(JSON.stringify(f.state())).not.toContain(request.verificationToken);
    expect(JSON.stringify(request.profile)).not.toContain('tokenHash');
    const data={studentId:id,id:request.profile.requests[0].id,approved:true,reason:'Fictional independent relationship check'};
    await expect(f.learners.review(f.owner.id,data)).rejects.toThrow('verified');
    await f.learners.verifyGuardian({token:request.verificationToken,authorityDeclared:true});
    expect((await f.learners.get(id)).essentialReady).toBe(false);
    await expect(f.learners.review(f.teacher.id,data)).rejects.toThrow('reviewer');
    await expect(f.learners.review(f.outsider.id,data)).rejects.toThrow('reviewer');
    const reviews=await f.learners.reviews(f.owner.id);expect(reviews).toHaveLength(1);expect(JSON.stringify(reviews)).not.toContain('answers');expect(reviews[0].mailboxVerified).toBe(false);expect(reviews[0].tokenVerified).toBe(true);expect(reviews[0].verificationMethod).toBe('simulated-token');
    await f.learners.review(f.owner.id,data);p=await f.learners.get(id);expect(p.essentialReady).toBe(true);
    expect((await f.learners.update(id,{revision:p.revision,answers,complete:true})).complete).toBe(true);
  });
  it('rejects expired, reused, undeclared and withdrawn tokens',async()=>{
    const f=await setup();const id=f.student.id;await f.learners.update(id,{revision:0,ageBand:'under-18'});
    const r=await f.learners.requestGuardian(id,{email:'guardian@fictional.invalid',scopes:permissions});
    await expect(f.learners.verifyGuardian({token:r.verificationToken,authorityDeclared:false})).rejects.toThrow('declaration');
    await f.learners.verifyGuardian({token:r.verificationToken,authorityDeclared:true});
    await expect(f.learners.verifyGuardian({token:r.verificationToken,authorityDeclared:true})).rejects.toThrow('already used');
    const r2=await f.learners.requestGuardian(id,{email:'guardian2@fictional.invalid',scopes:permissions});f.advance();
    await expect(f.learners.verifyGuardian({token:r2.verificationToken,authorityDeclared:true})).rejects.toThrow('expired');
    const r3=await f.learners.requestGuardian(id,{email:'guardian3@fictional.invalid',scopes:permissions});await f.learners.withdraw(id);
    await expect(f.learners.verifyGuardian({token:r3.verificationToken,authorityDeclared:true})).rejects.toThrow('already used');
    expect((await f.learners.get(id)).answers).toEqual({});
  });
  it('routes unaffiliated relationship review to operator and refuses unauthorized scopes',async()=>{
    const f=await setup();const id=f.outsider.id;
    await f.learners.update(id,{revision:0,ageBand:'under-18'});
    const r=await f.learners.requestGuardian(id,{email:'guardian@fictional.invalid',scopes:{...permissions,externalAI:false}});
    await f.learners.verifyGuardian({token:r.verificationToken,authorityDeclared:true});
    const d={studentId:id,id:r.profile.requests[0].id,approved:true,reason:'Fictional operator relationship check'};
    await expect(f.learners.review(f.owner.id,d)).rejects.toThrow('reviewer');
    await f.school.repository.transaction(s=>{s.accounts.find(a=>a.id===f.owner.id)!.role='operator';});
    await f.learners.review(f.owner.id,d);const p=await f.learners.get(id);
    await expect(f.learners.update(id,{revision:p.revision,permissions})).rejects.toThrow('Guardian');
    expect(p.externalAIAllowed).toBe(false);
  });
  it('excludes identity, age, guardians, private comfort and exact schedules from provider projection',()=>{
    const p=initialLearnerProfile('private-id','2026-11-01T00:00:00Z');p.ageBand='adult';p.permissions=permissions;
    p.answers={...answers,interests:['football'],subjects:['Science'],formats:['steps'],readingEase:'ok',length:'short',medium:'both',confusion:'quiet',input:'type',studyTime:'evening',confidence:[{subject:'Science',rating:2},{subject:'Art',rating:4}]};
    const projection=teachingPreferences(p,'Science');expect(projection?.confidence).toBe(2);
    for(const key of ['preferredName','ageBand','guardianEmail','comfort','studyTime','accountId','confusion'])expect(projection).not.toHaveProperty(key);
    p.permissions.externalAI=false;expect(teachingPreferences(p,'Science')).toBeUndefined();
  });
  it('keeps real learner onboarding gated even when account creation flags change',async()=>{
    const f=await setup();await f.school.repository.transaction(s=>{s.accounts.find(a=>a.id===f.student.id)!.simulated=false;});
    await expect(f.learners.get(f.student.id)).rejects.toThrow('release review');
  });
});
