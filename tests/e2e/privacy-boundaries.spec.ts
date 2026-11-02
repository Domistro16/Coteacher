import {test,expect,type Page} from '@playwright/test';
import {emptyProgress} from '@coteacher/shared';
import {learnerId} from '../../delivery/school-lessons';
test.setTimeout(120000);
const privateMarker='PRIVATE-QUESTIONNAIRE-BATCH2-7f62';
type Account={id:string;email:string;role:string};
const accounts=()=>JSON.parse(process.env.COTEACHER_PRIVACY_ACCOUNTS!) as Account[];
const account=(email:string)=>accounts().find(a=>a.email===email+'@fictional.invalid')!;
async function api(page:Page,path:string,data?:unknown){return page.evaluate(async({path,data})=>{
  const r=await fetch('/api/v1/'+path,{method:data===undefined?'GET':'POST',headers:data===undefined?{}:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});
  return {status:r.status,cache:r.headers.get('cache-control'),body:await r.json()};
},{path,data});}
async function login(page:Page,email:string,password='fictional-password-123'){
  const r=await api(page,'login',{email:email+'@fictional.invalid',password});expect(r.status).toBe(200);
  expect((await api(page,'me')).status).toBe(200);
}
async function victim(page:Page){
  await login(page,'student');const p=await api(page,'learner/profile');
  expect((await api(page,'learner/profile',{revision:p.body.revision,answers:{...p.body.answers,preferredName:privateMarker}})).status).toBe(200);
  const publications=await api(page,'lessons');expect(publications.status).toBe(200);
  const pack=await api(page,`lessons/${publications.body[0].id}`);expect(pack.status).toBe(200);
  expect((await api(page,`lessons/${publications.body[0].id}/progress`,emptyProgress(pack.body))).status).toBe(200);
  return {id:publications.body[0].id as string,profile:await api(page,'learner/profile')};
}
test('managed browser sessions enforce teacher/admin/other-school private endpoint matrix and actor ownership',async({page,context},info)=>{
  await page.goto('/');
  const library=page.getByRole('button',{name:'Open online school library',exact:true});
  await expect(library.or(page.getByLabel('Email or school-issued username',{exact:true}))).toBeVisible();if(await library.isVisible())await library.click();
  await page.getByLabel('Email or school-issued username',{exact:true}).fill('student@fictional.invalid');await page.getByLabel('Password',{exact:true}).fill('fictional-password-123');await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page.getByRole('navigation',{name:'Main navigation'})).toBeVisible();
  const v=await victim(page);
  const cookies=await context.cookies();expect(cookies.find(c=>c.name==='__Host-coteacher_auth')).toMatchObject({httpOnly:true,secure:true,sameSite:'Lax',path:'/'});
  expect(await page.evaluate(()=>document.cookie)).not.toContain('__Host-coteacher_auth');
  const rows:unknown[]=[];
  for(const identity of ['teacher','admin','owner','other-teacher','other-owner']){
    await login(page,identity);
    const requests:[string,unknown?][]=[['learner/profile'],['learner/profile',{revision:v.profile.body.revision,accountId:account('student').id,answers:{preferredName:'attacker'}}],['learner/withdraw',{accountId:account('student').id}],['learner/improvement/withdraw',{accountId:account('student').id}],['learner/guardian',{accountId:account('student').id,email:'attacker@fictional.invalid'}],[`lessons/${v.id}/learning`],[`lessons/${v.id}/learning`,{completed:true,studentId:account('student').id}]];
    for(const [path,data] of requests){const r=await api(page,path,data);expect(r.status,identity+' '+path).toBe(403);expect(r.cache).toBe('no-store');expect(JSON.stringify(r.body)).not.toContain(privateMarker);rows.push({identity,path,method:data?'POST':'GET',status:r.status});}
    const snapshot=await api(page,'me');expect(JSON.stringify(snapshot.body)).not.toMatch(/PRIVATE-QUESTIONNAIRE|memoryEnvelope|privateLearners|decisions/);
  }
  await login(page,'admin','fictional-aal1-password');
  const aal1=await api(page,'guardian/reviews');expect(aal1.status).toBe(403);expect(aal1.body.error).toContain('authenticator');
  for(const identity of ['outsider','other-student']){
    await login(page,identity);
    const own=await api(page,'learner/profile?accountId='+account('student').id+'&studentId='+account('student').id);
    expect(own.status).toBe(200);expect(own.cache).toBe('no-store');expect(own.body.accountId).toBe(account(identity).id);expect(JSON.stringify(own.body)).not.toContain(privateMarker);
    const spoof=await api(page,'learner/profile',{revision:own.body.revision,accountId:account('student').id,answers:{preferredName:'attacker'}});expect(spoof.status).toBe(400);
    expect((await api(page,'learner/'+account('student').id+'/profile')).status).toBe(404);
    const learning=await api(page,`lessons/${v.id}/learning?studentId=${account('student').id}`);
    expect(learning.status).toBe(identity==='outsider'?200:403);expect(JSON.stringify(learning.body)).not.toContain(privateMarker);
    if(identity==='outsider'){
      expect(learning.body.memory.learnerId).toBe(learnerId(account(identity).id));expect(learning.body.memory.learnerId).not.toBe(learnerId(account('student').id));
      // Victim progress exists, but target fields cannot supply it for this actor.
      expect((await api(page,`lessons/${v.id}/learning`,{completed:true,studentId:account('student').id})).status).toBe(409);
      expect((await api(page,`lessons/${v.id}/progress?studentId=${account('student').id}`)).body).toBeNull();
    }
    if(identity==='other-student')expect((await api(page,`lessons/${v.id}/learning`,{completed:true})).status).toBe(403);
    // Withdrawal ignores a supplied target and clears only this signed-in learner.
    expect((await api(page,'learner/withdraw',{accountId:account('student').id})).status).toBe(200);
  }
  await login(page,'student');const unchanged=await api(page,'learner/profile');expect(unchanged.body.answers.preferredName).toBe(privateMarker);expect(unchanged.cache).toBe('no-store');
  const replay=(await context.cookies()).filter(c=>c.name==='__Host-coteacher_auth');
  await api(page,'logout',{});expect((await api(page,'learner/profile')).status).toBe(401);expect((await api(page,`lessons/${v.id}/learning`)).status).toBe(401);
  await context.addCookies(replay);const revoked=await api(page,'learner/profile');expect(revoked.status).toBe(401);expect(revoked.cache).toBe('no-store');
  await info.attach('denial-matrix.json',{body:JSON.stringify({simulated:true,issuer:'mocked; real SDK/cookie/router',rows},null,2),contentType:'application/json'});
});

test('guardian review metadata is school-scoped and cannot disclose private answers',async({page})=>{
  await page.goto('/');await login(page,'minor-student');const p=await api(page,'learner/profile');expect(p.body.ageBand).toBe('under-18');
  const request=await api(page,'learner/guardian',{email:'guardian@fictional.invalid',scopes:{essential:true,personalization:true,externalAI:false}});expect(request.status).toBe(201);
  const id=request.body.profile.requests.at(-1).id;
  for(const identity of ['teacher','other-teacher','other-owner','other-student']){
    await login(page,identity);const reviews=await api(page,'guardian/reviews');expect(reviews.status).toBe(200);expect(reviews.body).toEqual([]);
    expect((await api(page,'guardian/reviews',{studentId:account('minor-student').id,id,approved:true,reason:'Fictional review'})).status).toBe(403);
  }
  await login(page,'admin');const reviews=await api(page,'guardian/reviews');expect(reviews.status).toBe(200);expect(reviews.cache).toBe('no-store');expect(reviews.body).toHaveLength(1);
  expect(Object.keys(reviews.body[0]).sort()).toEqual(['authorityDeclared','expiresAt','guardianEmail','id','mailboxVerified','purpose','schoolId','scopes','simulated','status','studentId','tokenVerified'].sort());
  expect(JSON.stringify(reviews.body)).not.toMatch(/answers|PRIVATE-QUESTIONNAIRE|memory|decision|tokenHash/);
  // No simulated guardian declaration is promoted into a relationship approval.
  expect((await api(page,'guardian/reviews',{studentId:account('minor-student').id,id,approved:true,reason:'Fictional review'})).status).toBe(409);
});

test('service worker bypasses stale private API cache entries after a managed account switch',async({page})=>{
  await page.goto('/');await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();
  await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
  await login(page,'student');const p=await api(page,'learner/profile');expect(p.status).toBe(200);
  expect(await page.evaluate(async()=>{for(const name of await caches.keys())if(await(await caches.open(name)).match('/api/v1/learner/profile'))return true;return false;})).toBe(false);
  await page.evaluate(async marker=>{const name=(await caches.keys()).find(k=>k.startsWith('coteacher-'))!;const cache=await caches.open(name);await cache.put('/api/v1/learner/profile',new Response(JSON.stringify({answers:{preferredName:marker}}),{headers:{'Content-Type':'application/json'}}));},privateMarker);
  await login(page,'teacher');const denied=await api(page,'learner/profile');expect(denied.status).toBe(403);expect(denied.cache).toBe('no-store');expect(JSON.stringify(denied.body)).not.toContain(privateMarker);
  // A new API response is not silently put back into static CacheStorage.
  const checks=await page.evaluate(async()=>{const out:string[]=[];for(const name of await caches.keys()){const c=await caches.open(name);await c.delete('/api/v1/learner/profile');for(const r of await c.keys())out.push(new URL(r.url).pathname);}return out;});
  expect(checks.filter(p=>p.startsWith('/api/'))).toEqual([]);
  expect((await api(page,'learner/profile')).status).toBe(403);
  expect(await page.evaluate(async()=>{for(const name of await caches.keys())if(await(await caches.open(name)).match('/api/v1/learner/profile'))return true;return false;})).toBe(false);
});

test('school progress/package exports exclude private profile and model memory',async({page})=>{
  await page.goto('/');await login(page,'student');
  const p=await api(page,'learner/profile');expect((await api(page,'learner/profile',{revision:p.body.revision,answers:{...p.body.answers,preferredName:privateMarker},complete:true})).status).toBe(200);
  const list=await api(page,'lessons'),id=list.body[0].id,pack=await api(page,`lessons/${id}`);expect(pack.status).toBe(200);
  const progress=emptyProgress(pack.body);expect((await api(page,`lessons/${id}/progress`,progress)).status).toBe(200);
  const exported=await api(page,`lessons/${id}/progress`);expect(exported.status).toBe(200);expect(exported.cache).toBe('no-store');
  for(const value of [pack.body,exported.body,(await api(page,'me')).body])expect(JSON.stringify(value)).not.toMatch(/PRIVATE-QUESTIONNAIRE|memoryEnvelope|privateLearners|decisions|nextCheckProbability/);
  expect(Object.keys(exported.body).sort()).toEqual(Object.keys(progress).sort());
  await login(page,'teacher');const overview=await api(page,'me');expect(JSON.stringify(overview.body)).not.toMatch(/PRIVATE-QUESTIONNAIRE|memoryEnvelope|privateLearners|decisions/);
  const records=await api(page,`teaching/${list.body[0].offeringId}/progress`);expect(records.status).toBe(200);expect(records.body).toHaveLength(1);expect(records.cache).toBe('no-store');expect(JSON.stringify(records.body)).not.toMatch(/PRIVATE-QUESTIONNAIRE|memoryEnvelope|privateLearners|decisions|nextCheckProbability/);
  for(const identity of ['admin','other-teacher','other-owner','other-student']){await login(page,identity);expect((await api(page,`teaching/${list.body[0].offeringId}/progress`)).status).toBe(403);}
  await login(page,'teacher');
  const ownProgress=await api(page,`lessons/${id}/progress?studentId=${account('student').id}`);expect(ownProgress.status).toBe(200);expect(ownProgress.body).toBeNull();
});
