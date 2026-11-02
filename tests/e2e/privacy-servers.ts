import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { preview, type PreviewServer } from 'vite';
import { LocalSchoolRepository, SchoolService } from '../../delivery/school-store';
import { LocalPrivateStorage } from '../../delivery/private-storage';
import { SchoolLessons } from '../../delivery/school-lessons';
import { LearnerService } from '../../delivery/learner-service';
import { PreparationService } from '../../delivery/preparation-service';
import { SupabaseIdentity } from '../../delivery/managed-auth';
import { schoolHttp } from '../../delivery/school-http';
import { MockTutor } from '../tutor-fixture';
import { seedLearning } from './seed-learning';

/** Real SDK, cookies, router, repositories and browser; mocked identity issuer only.
 * No arbitrary decoded token is accepted: /user verifies the issued-token map. */
export default async function setup(){
  process.env.COTEACHER_TEST_NO_ENV_FILES='true';
  for(const key of ['COTEACHER_SCHOOL_DATABASE_URL','COTEACHER_SUPABASE_URL','COTEACHER_SUPABASE_PUBLISHABLE_KEY','COTEACHER_R2_ENDPOINT','COTEACHER_GUARDIAN_MAIL_KEY','COTEACHER_GUARDIAN_MAIL_FROM','OPENAI_API_KEY'])delete process.env[key];
  process.env.COTEACHER_PUBLIC='false';process.env.COTEACHER_ALLOW_REAL_STUDENTS='false';process.env.COTEACHER_GUARDIAN_MAIL_MODE='simulated';
  const folder=resolve('test-results','privacy-'+randomUUID()),school=new SchoolService(new LocalSchoolRepository(folder));
  await seedLearning(school,folder);
  const add=(role:string,email:string)=>school.register({role,email,name:'Fictional '+email.split('@')[0],password:'fictional-password-123',simulated:true});
  const otherOwner=await add('owner','other-owner@fictional.invalid');
  const otherSchool=await school.command(otherOwner.id,'register-school',{name:'Other Fictional Academy',location:'Fictional',contact:'other@fictional.invalid',evidence:'Simulated',levels:['JSS2']}) as {id:string};
  await school.repository.transaction(s=>{s.schools.find(x=>x.id===otherSchool.id)!.status='active';});
  const originalSchool=(await school.snapshot((await school.repository.transaction(s=>s.accounts.find(a=>a.email==='owner@fictional.invalid')!)).id)).schools[0];
  for(const [email,schoolId,owner,admin] of [
    ['admin@fictional.invalid',originalSchool.id,(await school.repository.transaction(s=>s.accounts.find(a=>a.email==='owner@fictional.invalid')!)).id,true],
    ['minor-student@fictional.invalid',originalSchool.id,(await school.repository.transaction(s=>s.accounts.find(a=>a.email==='owner@fictional.invalid')!)).id,false],
    ['other-teacher@fictional.invalid',otherSchool.id,otherOwner.id,false],
    ['other-student@fictional.invalid',otherSchool.id,otherOwner.id,false],
  ] as const){
    const account=await add(email.includes('student')?'student':'teacher',email);
    await school.command(account.id,'request-join',{schoolId});
    const member=(await school.snapshot(owner)).memberships.find(m=>m.accountId===account.id)!;
    await school.command(owner,'membership',{schoolId,id:member.id,status:'active'});
    if(admin)await school.repository.transaction(s=>{s.memberships.find(m=>m.id===member.id)!.role='admin';});
  }
  const accounts=await school.repository.transaction(s=>s.accounts.map(a=>({id:a.id,email:a.email,role:a.role,name:a.name})));
  const users=new Map(accounts.map(a=>[a.email,{id:randomUUID(),aud:'authenticated',role:'authenticated',email:a.email,email_confirmed_at:new Date().toISOString(),created_at:new Date().toISOString(),app_metadata:{provider:'email'},user_metadata:{coteacherRole:a.role,name:a.name,...(a.role==='student'?a.email.startsWith('minor-')?{studentRegistrationRoute:'guardian-assisted',guardianConsent:true}:{studentRegistrationRoute:'adult-self',adultSelfAuthorization:true}:{})}}]));
  await school.repository.transaction(s=>{for(const a of accounts)s.identities.push({accountId:a.id,providerId:users.get(a.email)!.id});});
  const issued=new Map<string,(typeof users extends Map<string,infer U>?U:never)>();
  const issuer=(async(raw,init)=>{
    const url=new URL(String(raw)),headers=new Headers(init?.headers),token=headers.get('authorization')?.replace(/^Bearer /,'');
    if(url.pathname.endsWith('/token') && url.searchParams.get('grant_type')==='password'){
      const data=JSON.parse(String(init?.body)),user=users.get(data.email);
      if(!user || !['fictional-password-123','fictional-aal1-password'].includes(data.password))return Response.json({msg:'Invalid credentials'},{status:400});
      const aal=data.password==='fictional-aal1-password'?'aal1':'aal2';
      const access=[{alg:'HS256',typ:'JWT'},{sub:user.id,exp:Math.floor(Date.now()/1000)+3600,aal,amr:[{method:aal==='aal2'?'totp':'password',timestamp:Math.floor(Date.now()/1000)}]},randomUUID()].map(x=>Buffer.from(typeof x==='string'?x:JSON.stringify(x)).toString('base64url')).join('.');
      issued.set(access,user);
      return Response.json({access_token:access,refresh_token:'fictional-refresh-'+randomUUID(),token_type:'bearer',expires_in:3600,user});
    }
    if(url.pathname.endsWith('/user'))return token && issued.has(token)?Response.json(issued.get(token)):Response.json({msg:'Invalid token'},{status:401});
    if(url.pathname.endsWith('/logout')){if(token)issued.delete(token);return new Response(null,{status:204});}
    throw new Error('Unexpected mocked issuer request: '+url.pathname);
  }) as typeof fetch;
  const storage=new LocalPrivateStorage(folder+'/private'),lessons=new SchoolLessons(school,storage);
  const learners=new LearnerService(school,'simulated-local-school-tutor-key-v1');
  const preparation=new PreparationService(school,lessons,storage,new MockTutor());
  const origins=['http://localhost:4273','http://localhost:4274','http://localhost:4275'];
  const handle=schoolHttp(school,{identity:new SupabaseIdentity('https://issuer.fictional.invalid','fictional-publishable-key',[],issuer),lessons,learners,preparation,origins,studentUrl:origins[0],teacherUrl:origins[1],schoolUrl:origins[2]});
  const server=createServer((req,res)=>{void handle(req,res).then(handled=>{if(!handled){res.writeHead(404);res.end();}}).catch(error=>{res.writeHead(500);res.end(String(error));});});
  await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
  const address=server.address();if(!address || typeof address==='string')throw new Error('No test server address');
  process.env.COTEACHER_DELIVERY_URL='http://127.0.0.1:'+address.port;
  process.env.COTEACHER_PRIVACY_ACCOUNTS=JSON.stringify(accounts);
  const servers:PreviewServer[]=[];
  const close=async()=>{for(const p of servers){if('closeAllConnections' in p.httpServer)p.httpServer.closeAllConnections();await new Promise<void>(r=>p.httpServer.close(()=>r()));}server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));};
  try{for(const [app,port] of [['student',4273],['teacher',4274],['school',4275]] as const)servers.push(await preview({root:resolve('apps',app),configFile:resolve('apps',app,'vite.config.ts'),envDir:false,build:process.env.COTEACHER_E2E_BUILD_ROOT?{outDir:resolve(process.env.COTEACHER_E2E_BUILD_ROOT,app)}:undefined,preview:{host:'localhost',port,strictPort:true,open:false}}));}catch(error){await close();throw error;}
  return close;
}
