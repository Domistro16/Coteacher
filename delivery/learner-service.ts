import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { SchoolState } from '../packages/shared/src/generated/school-state';
import { essentialReady, initialLearnerProfile, learningNoticeVersion, optionalAllowed, validLearnerProfile, type LearnerProfile } from '../packages/shared/src/learner-profile';
import { SchoolError, type SchoolService } from './school-store';
import { openServer, sealServer } from './server-encryption';
import { learnerId } from './school-lessons';
import { emptyPrivateMemory, validPrivateMemory, updateLearnerEvidence, completeLearnerLesson, pruneEvidence,type LessonKnowledge, type PrivateLearnerMemory } from '../packages/shared/src/learning-engine';
import type { LessonPackage, ProgressRecord, TutorState } from '@coteacher/shared';
import { teachingPreferences } from '../packages/shared/src/learner-profile';
import type { GuardianDelivery } from './guardian-mail';
import {improvementDataNoticeVersion,improvementDataAvailability} from '../packages/shared/src/improvement-data';

function fail(message: string, status = 400): never { throw new SchoolError(status, message); }
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
type Request = LearnerProfile['requests'][number];
/** Inline encrypted records are covered by aggregate backup/restore and contain no shared content. */
export class LearnerService {
  private key: Buffer;
  constructor(private school: SchoolService, secret: string, private now = () => new Date(),private delivery?:GuardianDelivery) {
    if (secret.length < 32) throw new Error('A stable private learner storage key is required.');
    this.key = createHash('sha256').update('learner-profile-v1:' + secret).digest();
  }
  private read(s: SchoolState, actor: string): LearnerProfile {
    const account = s.accounts.find(a => a.id === actor);
    if (account?.role !== 'student') fail('Student account required.', 403);
    // No environment flag can accidentally enable the unapproved real-child workflow.
    if (!account.simulated) fail('Real learner onboarding awaits release review.', 503);
    const row = s.privateLearners.find(r => r.accountId === actor);
    const p = row ? openServer(row.envelope, this.key, 'learner-profile-v1:' + actor) : initialLearnerProfile(actor, this.now().toISOString());
    if (!validLearnerProfile(p) || p.accountId !== actor) fail('Private learner record is invalid.', 500);
    // Missing legacy choices never grant a new purpose. Exclusions survive backup restore.
    p.permissions.improvementData=p.permissions.improvementData===true && !row?.improvementExcludedAt;
    return p;
  }
  private save(s: SchoolState, p: LearnerProfile) {
    p.revision++; p.updatedAt = this.now().toISOString();
    if (!validLearnerProfile(p)) fail('Invalid learning preferences.');
    const envelope = sealServer(p, this.key, 'learner-profile-v1:' + p.accountId);
    const row = s.privateLearners.find(r => r.accountId === p.accountId);
    if (row) row.envelope = envelope; else s.privateLearners.push({ accountId: p.accountId, envelope });
  }
  private memory(s:SchoolState,actor:string,p:LearnerProfile):PrivateLearnerMemory {
    const row=s.privateLearners.find(r=>r.accountId===actor);
    const value=row?.memoryEnvelope?openServer(row.memoryEnvelope,this.key,'learner-memory-v1:'+actor):emptyPrivateMemory(learnerId(actor));
    if(!validPrivateMemory(value) || value.learnerId!==learnerId(actor))fail('Invalid private learning memory.',500);
    const preferences=Object.fromEntries(Object.entries(p.answers).filter(([k])=>['formats','length','readingEase','medium','confidence','input','feedback',...accessibilityKeys].includes(k)));
    const allowed=optionalAllowed(p,'personalization');
    return pruneEvidence({...value,consentRevision:p.revision,personalization:allowed,preferences,...(p.optionalClearedAt?{clearedBefore:p.optionalClearedAt}:{}),...(!allowed?{evidence:[],completedLessons:[],promptedLessons:[]}:{} )},this.now().toISOString());
  }
  private saveMemory(s:SchoolState,actor:string,memory:PrivateLearnerMemory) {
    if(!validPrivateMemory(memory) || memory.learnerId!==learnerId(actor))fail('Invalid private learning memory.');
    const row=s.privateLearners.find(r=>r.accountId===actor);if(!row)fail('Save authorization choices first.',409);
    row.memoryEnvelope=sealServer(memory,this.key,'learner-memory-v1:'+actor);
  }
  learningContext(actor:string) {
    return this.school.repository.transaction(s=>{const p=this.read(s,actor);const memory=this.memory(s,actor,p);if(s.privateLearners.some(r=>r.accountId===actor))this.saveMemory(s,actor,memory);return memory;});
  }
  observe(actor:string,lesson:LessonPackage,progress:ProgressRecord,knowledge:LessonKnowledge,completed=false,tutor?:TutorState,promptDismissed=false) {
    return this.school.repository.transaction(s=>{
      const p=this.read(s,actor);let memory=this.memory(s,actor,p);
      memory=updateLearnerEvidence(memory,lesson,progress,knowledge,this.now().toISOString(),tutor);
      if(completed)memory=completeLearnerLesson(memory,knowledge,this.now().toISOString());
      const lessonKey=knowledge.lessonId+'@'+knowledge.lessonRevision;
      if(promptDismissed && memory.personalization && memory.completedLessons.some(x=>x.lessonId===lessonKey) && !memory.promptedLessons.includes(lessonKey) && memory.promptedLessons.length<3)memory.promptedLessons.push(lessonKey);
      if(s.privateLearners.some(r=>r.accountId===actor))this.saveMemory(s,actor,memory);
      return memory;
    });
  }
  async providerPreferences(actor:string,subject:string,external=true) {
    return this.school.repository.transaction(s=>{const p=this.read(s,actor);return teachingPreferences(p,subject,external?'external':'local');});
  }
  async externalAllowed(actor:string,external=true) {
    return this.school.repository.transaction(s=>{
      // Legacy declarations do not establish verified authorization for new model dispatch.
      if(!s.privateLearners.some(r=>r.accountId===actor))return false;
      const p=this.read(s,actor);return external?optionalAllowed(p,'externalAI'):essentialReady(p);
    });
  }
  improvementEligibility(actor:string,schoolId:string) {
    return this.school.repository.transaction(s=>{
      const p=this.student(s,actor);
      const belongs=s.memberships.some(m=>m.accountId===actor && m.schoolId===schoolId && m.role==='student' && m.status==='active') && s.schools.some(x=>x.id===schoolId && x.status==='active');
      return {schoolId,consentAllowed:belongs && optionalAllowed(p,'improvementData'),eligibleForTraining:false as const,...improvementDataAvailability};
    });
  }
  private excludeImprovement(s:SchoolState,actor:string,at=this.now().toISOString(),requestId?:string) {
    const row=s.privateLearners.find(r=>r.accountId===actor);
    if(row){row.improvementExcludedAt=at;delete row.improvementFeaturesEnvelope;
      if(requestId)row.improvementAuthorizationRequestId=requestId;else delete row.improvementAuthorizationRequestId;}
  }
  private acceptImprovement(s:SchoolState,p:LearnerProfile) {
    p.improvementNoticeVersion=improvementDataNoticeVersion;p.improvementAcceptedAt=this.now().toISOString();
    const row=s.privateLearners.find(r=>r.accountId===p.accountId);if(row){delete row.improvementExcludedAt;delete row.improvementAuthorizationRequestId;}
  }
  private improvementGuardianGrant(s:SchoolState,p:LearnerProfile,r:Request) {
    const row=s.privateLearners.find(row=>row.accountId===p.accountId);
    return r.scopes.improvementData===true && r.improvementNoticeVersion===improvementDataNoticeVersion &&
      (!row?.improvementExcludedAt || row.improvementAuthorizationRequestId===r.id);
  }
  private view(p: LearnerProfile) {
    return { ...p, requests: p.requests.map(({ tokenHash, ...r }) => ({ ...r,
      expired: ['pending','verified'].includes(r.status) && Date.parse(r.expiresAt) <= this.now().getTime() })),
      essentialReady: essentialReady(p), personalizationAllowed: optionalAllowed(p, 'personalization'), externalAIAllowed: optionalAllowed(p, 'externalAI'),
      improvementDataAllowed:optionalAllowed(p,'improvementData'),improvementDataAvailability };
  }
  get(actor: string) { return this.school.repository.transaction(s => this.view(this.read(s, actor))); }
  initializeAge(actor:string,ageBand:'adult'|'under-18') {
    return this.school.repository.transaction(s=>{
      if(s.privateLearners.some(r=>r.accountId===actor))return;
      const p=this.student(s,actor);p.ageBand=ageBand;this.save(s,p);
    });
  }
  private student(s: SchoolState, actor: string) {
    if (s.credentials.some(c => c.accountId === actor && c.mustChange)) fail('Change your initial password first.', 403);
    return this.read(s, actor);
  }
  update(actor: string, data: Record<string, unknown>) {
    return this.school.repository.transaction(s => {
      const p = this.student(s, actor);
      if (data.revision !== p.revision) fail('Preferences changed. Reload before saving.', 409);
      if (Object.keys(data).some(k => !['revision','ageBand','permissions','answers','step','complete','improvementNoticeVersion'].includes(k))) fail('Unknown preference operation.');
      let excludeImprovement=false;
      if (data.ageBand !== undefined) {
        if (!['adult','under-18'].includes(String(data.ageBand))) fail('Choose an age band.');
        if (p.ageBand !== 'unknown' && p.ageBand !== data.ageBand) fail('Reset authorization before changing age band.');
        p.ageBand = data.ageBand as LearnerProfile['ageBand'];
      }
      if (p.ageBand === 'unknown') fail('Answer the age question first.');
      if (data.permissions !== undefined) {
        const supplied=data.permissions as LearnerProfile['permissions'];
        const candidate = { ...p, permissions: {...supplied,improvementData:supplied?.improvementData??p.permissions.improvementData??false} };
        if (!validLearnerProfile(candidate)) fail('Choose processing permissions separately.');
        const next = candidate.permissions;
        if (p.ageBand === 'under-18' && (Object.keys(next) as (keyof typeof next)[]).some(k => next[k] && !p.requests.some(r => r.status === 'approved' && r.scopes[k] && (k!=='improvementData'||this.improvementGuardianGrant(s,p,r))))) fail('Guardian and relationship approval required.', 403);
        if(next.improvementData && (!p.permissions.improvementData || p.improvementNoticeVersion!==improvementDataNoticeVersion)){
          if(data.improvementNoticeVersion!==improvementDataNoticeVersion)fail('Read and explicitly accept the improvement-data notice.');
          if(!essentialReady(candidate))fail('Essential learning authorization is required before improvement permission.',403);
          this.acceptImprovement(s,p);
        }
        excludeImprovement=!next.essential || supplied?.improvementData===false;
        if(excludeImprovement)p.requests.filter(r=>r.purpose==='improvementData' && !['withdrawn','rejected'].includes(r.status)).forEach(r=>r.status='withdrawn');
        if(!next.essential)next.improvementData=false;
        if (p.permissions.personalization && !next.personalization) {p.answers = accessibilityOnly(p.answers);p.optionalClearedAt=this.now().toISOString();}
        if (!next.personalization) { const row=s.privateLearners.find(r=>r.accountId===actor);if(row)delete row.memoryEnvelope; }
        if (!next.externalAI) s.consents.filter(c=>c.accountId===actor && c.kind==='external-ai').forEach(c=>c.withdrawn=true);
        p.permissions = next;
      }
      if (data.answers !== undefined) {
        if (!essentialReady(p)) fail('Complete authorization before the questionnaire.', 403);
        const candidate = { ...p, answers: data.answers };
        if (!validLearnerProfile(candidate)) fail('Check your answers and selection limits.');
        if (!optionalAllowed(p, 'personalization') && Object.keys(candidate.answers).some(k => !accessibilityKeys.includes(k))) fail('Enable optional personalization to save these answers.', 403);
        p.answers = candidate.answers;
      }
      if (data.step !== undefined) p.step = data.step as number;
      if (data.complete === true) {
        if (!essentialReady(p)) fail('Complete authorization first.', 403);
        if (optionalAllowed(p, 'personalization')) {
          for (const key of ['preferredName','classLevel','subjects','language','readingEase','formats','length','medium','confusion','input'] as const)
            if (p.answers[key] === undefined || (Array.isArray(p.answers[key]) && !p.answers[key]!.length)) fail('Complete the required questions or disable optional personalization.');
        }
        p.complete = true; p.step = 4;
      }
      if (!p.permissions.essential) { p.answers = {}; p.complete = false; }
      this.save(s, p);if(excludeImprovement)this.excludeImprovement(s,actor);return this.view(p);
    });
  }
  withdraw(actor: string) {
    return this.school.repository.transaction(s => {
      const p = this.student(s, actor);
      p.permissions = { essential: false, personalization: false, externalAI: false,improvementData:false };
      p.answers = {}; p.complete = false; p.step = 0; p.ageBand = 'unknown'; p.withdrawnAt = this.now().toISOString();
      p.optionalClearedAt=p.withdrawnAt;
      p.requests.forEach(r => { if (!['rejected','withdrawn'].includes(r.status)) r.status = 'withdrawn'; });
      const row=s.privateLearners.find(r=>r.accountId===actor);if(row)delete row.memoryEnvelope;
      s.consents.filter(c => c.accountId === actor && ['external-ai','local-ai'].includes(c.kind)).forEach(c => c.withdrawn = true);
      this.save(s, p);this.excludeImprovement(s,actor);return this.view(p);
    });
  }
  withdrawImprovement(actor:string) {
    return this.school.repository.transaction(s=>{
      const p=this.student(s,actor);p.permissions.improvementData=false;
      p.requests.filter(r=>r.purpose==='improvementData' && !['withdrawn','rejected'].includes(r.status)).forEach(r=>r.status='withdrawn');
      this.save(s,p);this.excludeImprovement(s,actor);return this.view(p);
    });
  }
  async requestGuardian(actor: string, data: Record<string, unknown>) {
    const result=await this.school.repository.transaction(s => {
      const p = this.student(s, actor);
      if (p.ageBand !== 'under-18') fail('Minor age band required.');
      const email = String(data.email ?? '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) fail('Enter a guardian email.');
      if(data.purpose!==undefined && !['learning','improvementData'].includes(String(data.purpose)))fail('Unknown guardian request purpose.');
      const purpose=data.purpose==='improvementData'?'improvementData':'learning';
      const scopes = data.scopes as LearnerProfile['permissions'];
      if (!validLearnerProfile({ ...p, permissions: scopes }))fail('Choose valid authorization scopes.');
      if(purpose==='improvementData'){
        if(!essentialReady(p) || scopes.essential || scopes.personalization || scopes.externalAI || scopes.improvementData!==true)fail('Improvement review requires existing learning authorization and only its separate scope.',403);
      }else if(!scopes.essential)fail('Essential processing authorization required.');
      if(scopes.improvementData && data.improvementNoticeVersion!==improvementDataNoticeVersion)fail('Read the separate improvement-data notice.');
      if (p.requests.length >= 30) fail('Contact the operator before requesting more reviews.', 429);
      p.requests.filter(r => ['pending','verified','approved'].includes(r.status) && (purpose==='learning'||r.purpose==='improvementData')).forEach(r => r.status = 'withdrawn');
      if(purpose==='learning'){p.permissions = { essential: false, personalization: false, externalAI: false,improvementData:false };p.answers = {}; p.complete = false;}
      else p.permissions.improvementData=false;
      const token = randomBytes(32).toString('hex');
      const membership = s.memberships.find(m => m.accountId === actor && m.status === 'active' && m.role === 'student' && s.schools.some(x => x.id === m.schoolId && x.status === 'active'));
      const r: Request = { id: randomUUID(), guardianEmail: email, tokenHash: digest(token), createdAt: this.now().toISOString(),
        expiresAt: new Date(this.now().getTime() + 7 * 86400000).toISOString(), noticeVersion: learningNoticeVersion,
          scopes: scopes as Request['scopes'],purpose,...(scopes.improvementData?{improvementNoticeVersion:improvementDataNoticeVersion}:{}), status: 'pending',deliveryMethod:this.delivery?'email':'simulated-link', ...(membership ? { schoolId: membership.schoolId } : {}) };
      p.requests.push(r); this.save(s, p);this.excludeImprovement(s,actor,r.createdAt,scopes.improvementData?r.id:undefined);
      // Fictional demonstration only. No mail is sent or claimed. Production delivery stays gated.
      return { profile: this.view(p), simulated: true, verificationToken: token, delivery: 'simulated-link-only' };
    });
    if(!this.delivery)return result;
    const r=result.profile.requests.at(-1)!;
    try{await this.delivery.send({requestId:r.id,email:r.guardianEmail,token:result.verificationToken,noticeVersion:r.noticeVersion,scopes:r.scopes,purpose:r.purpose,improvementNoticeVersion:r.improvementNoticeVersion});}
    catch{
      await this.school.repository.transaction(s=>{const p=this.read(s,actor);const request=p.requests.find(x=>x.id===r.id);if(request && request.status==='pending')request.status='withdrawn';this.save(s,p);});
      fail('Guardian email delivery was not accepted. Request a fresh link later.',503);
    }
    return {profile:result.profile,simulated:true,verificationToken:undefined,delivery:'email-accepted'};
  }
  async verifyGuardian(data: Record<string, unknown>) {
    if (typeof data.token !== 'string' || !/^[a-f0-9]{64}$/.test(data.token) || data.authorityDeclared !== true) fail('Valid link and guardian authority declaration required.');
    return this.school.repository.transaction(s => {
      for (const row of s.privateLearners) {
        const p = this.read(s, row.accountId);
        const r = p.requests.find(r => r.tokenHash === digest(String(data.token)));
        if (!r) continue;
        if (r.status !== 'pending' || Date.parse(r.expiresAt) <= this.now().getTime()) fail('This link has expired or was already used.', 410);
        r.status = 'verified'; r.verifiedAt = this.now().toISOString(); r.authorityDeclared = true;r.verificationMethod=r.deliveryMethod==='email'?'email-token':'simulated-token';
        this.save(s, p); return { verified: true, message: r.verificationMethod==='email-token'?'Mailbox verified. Independent relationship review is still required.':'Simulated token verified; real mailbox control is unverified. Independent relationship review is still required.', simulated: true };
      }
      fail('This link has expired or was already used.', 410);
    });
  }
  async guardianDetails(data: Record<string, unknown>) {
    if (typeof data.token !== 'string' || !/^[a-f0-9]{64}$/.test(data.token)) fail('Valid guardian link required.');
    return this.school.repository.transaction(s => {
      for (const row of s.privateLearners) {
        const p = this.read(s, row.accountId);
        const r = p.requests.find(r => r.tokenHash === digest(String(data.token)));
        if (!r) continue;
        if (r.status !== 'pending' || Date.parse(r.expiresAt) <= this.now().getTime()) fail('This link has expired or was already used.', 410);
        return { scopes: r.scopes, noticeVersion: r.noticeVersion,improvementNoticeVersion:r.improvementNoticeVersion,purpose:r.purpose??'learning', expiresAt: r.expiresAt,deliveryMethod:r.deliveryMethod, simulated: true };
      }
      fail('This link has expired or was already used.', 410);
    });
  }
  private reviewer(s: SchoolState, actor: string, r: Request, studentId: string) {
    if (actor === studentId || !s.accounts.some(a => a.id === actor && a.role !== 'student')) return false;
    if (!r.schoolId) return s.accounts.some(a => a.id === actor && a.role === 'operator');
    return s.schools.some(x => x.id === r.schoolId && x.status === 'active') &&
      s.memberships.some(m => m.accountId === studentId && m.schoolId === r.schoolId && m.status === 'active' && m.role === 'student') &&
      s.memberships.some(m => m.accountId === actor && m.schoolId === r.schoolId && m.status === 'active' && ['owner','admin'].includes(m.role));
  }
  reviews(actor: string) {
    return this.school.repository.transaction(s => s.privateLearners.flatMap(row => {
      const p = this.read(s, row.accountId);
      return p.requests.filter(r => this.reviewer(s, actor, r, p.accountId)).map(r => ({ id: r.id, studentId: p.accountId,
        guardianEmail: r.guardianEmail, status: r.status, scopes: r.scopes, schoolId: r.schoolId, expiresAt: r.expiresAt,
        mailboxVerified: r.verificationMethod==='email-token',tokenVerified:!!r.verifiedAt,verificationMethod:r.verificationMethod,purpose:r.purpose??'learning', authorityDeclared: r.authorityDeclared === true, simulated: true }));
    }));
  }
  review(actor: string, data: Record<string, unknown>) {
    return this.school.repository.transaction(s => {
      const p = this.read(s, String(data.studentId ?? ''));
      const r = p.requests.find(r => r.id === data.id);
      if (!r || !this.reviewer(s, actor, r, p.accountId)) fail('Relationship reviewer required.', 403);
      if (r.status !== 'verified' || !r.authorityDeclared || Date.parse(r.expiresAt) <= this.now().getTime()) fail('A current verified declaration is required.', 409);
      if (typeof data.reason !== 'string' || !data.reason.trim() || data.reason.length > 300 || typeof data.approved !== 'boolean') fail('Record the independent relationship review decision and reason.');
      r.status = data.approved ? 'approved' : 'rejected'; r.reason = data.reason; r.reviewerId = actor; r.reviewedAt = this.now().toISOString();
      if(data.approved){
        if(r.purpose==='improvementData'){
          if(!essentialReady(p) || !this.improvementGuardianGrant(s,p,r))fail('A fresh improvement authorization is required.',409);
          p.permissions.improvementData=true;this.acceptImprovement(s,p);
        }else{
          const improve=this.improvementGuardianGrant(s,p,r);
          p.permissions={...r.scopes,improvementData:improve};
          if(improve)this.acceptImprovement(s,p);
        }
      }
      this.save(s, p); return { saved: true };
    });
  }
}
const accessibilityKeys = ['largerText','captions','slowerAudio','reducedMotion'];
function accessibilityOnly(a: LearnerProfile['answers']): LearnerProfile['answers'] {
  return Object.fromEntries(Object.entries(a).filter(([k]) => accessibilityKeys.includes(k)));
}
