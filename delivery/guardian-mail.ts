import type { LearnerProfile } from '../packages/shared/src/learner-profile';
export interface GuardianDelivery {
  send(input:{requestId:string;email:string;token:string;noticeVersion:string;scopes:LearnerProfile['permissions']}):Promise<void>;
}
/** Explicitly configured transactional delivery. Tests inject fetch; no unsolicited mail is sent. */
export class ResendGuardianDelivery implements GuardianDelivery {
  constructor(private key:string,private from:string,private studentOrigin:string,private request:typeof fetch=fetch){
    if(!key || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from))throw new Error('Guardian delivery needs a sender and server-only API key.');
    const url=new URL(studentOrigin);if(url.protocol!=='https:' || url.origin!==studentOrigin)throw new Error('Guardian email links require the exact HTTPS student origin.');
  }
  async send(input:Parameters<GuardianDelivery['send']>[0]){
    const link=this.studentOrigin+'/#guardian='+input.token;
    const text=`Coteacher fictional learner authorization request.\n\nNotice: ${input.noticeVersion}\nEssential learning processing: ${input.scopes.essential?'requested':'declined'}\nOptional personalization: ${input.scopes.personalization?'requested':'declined'}\nExternal AI: ${input.scopes.externalAI?'requested':'declined'}\n\nReview the choices and authority declaration: ${link}\n\nThe link expires in seven days and can be used once. Mailbox verification alone is not parental authority; independent school/operator relationship review is also required. Ignore this message if you did not request it. Real-child onboarding is not enabled.`;
    const response=await this.request('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+this.key,'Content-Type':'application/json','Idempotency-Key':'guardian-'+input.requestId},body:JSON.stringify({from:this.from,to:[input.email],subject:'Review Coteacher fictional learner authorization',text}),signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error('Guardian email delivery was not accepted. Request a fresh link later.');
  }
}
