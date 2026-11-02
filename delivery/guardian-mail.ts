import type { LearnerProfile } from '../packages/shared/src/learner-profile';
export interface GuardianDelivery {
  send(input:{requestId:string;email:string;token:string;noticeVersion:string;scopes:LearnerProfile['permissions'];purpose?:'learning'|'improvementData';improvementNoticeVersion?:string}):Promise<void>;
}
/** Explicitly configured transactional delivery. Tests inject fetch; no unsolicited mail is sent. */
export class ResendGuardianDelivery implements GuardianDelivery {
  constructor(private key:string,private from:string,private studentOrigin:string,private request:typeof fetch=fetch){
    if(!key || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from))throw new Error('Guardian delivery needs a sender and server-only API key.');
    const url=new URL(studentOrigin);if(url.protocol!=='https:' || url.origin!==studentOrigin)throw new Error('Guardian email links require the exact HTTPS student origin.');
  }
  async send(input:Parameters<GuardianDelivery['send']>[0]){
    const link=this.studentOrigin+'/#guardian='+input.token;
    const separate=input.purpose==='improvementData';
    const text=`Coteacher fictional learner authorization request.\n\n${separate?'Separate improvement-data permission; existing learning choices stay unchanged.\n':''}Notice: ${input.noticeVersion}\nEssential learning processing: ${separate?'unchanged':input.scopes.essential?'requested':'declined'}\nOptional personalization: ${separate?'unchanged':input.scopes.personalization?'requested':'declined'}\nExternal AI: ${separate?'unchanged':input.scopes.externalAI?'requested':'declined'}\nImprovement data: ${input.scopes.improvementData?'requested':'declined'}${input.scopes.improvementData?' (notice '+input.improvementNoticeVersion+')':''}. Collection and export are currently disabled. No raw questions, audio, names or questionnaire answers belong in improvement events.\n\nReview the choices and authority declaration: ${link}\n\nThe link expires in seven days and can be used once. Mailbox verification alone is not parental authority; independent school/operator relationship review is also required. Ignore this message if you did not request it. Real-child onboarding is not enabled.`;
    const response=await this.request('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+this.key,'Content-Type':'application/json','Idempotency-Key':'guardian-'+input.requestId},body:JSON.stringify({from:this.from,to:[input.email],subject:'Review Coteacher fictional learner authorization',text}),signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error('Guardian email delivery was not accepted. Request a fresh link later.');
  }
}
