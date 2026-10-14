import { existsSync } from 'node:fs';
import { readFile, writeFile, mkdir, mkdtemp, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium, expect } from '@playwright/test';
import { preview } from 'vite';
import { decryptPayload } from '@coteacher/shared';
import { startDelivery } from '../delivery/server';
import { OpenAITutor } from '../delivery/tutor-provider';
import { OpenAILiveVoice } from '../delivery/live-provider';
for(const file of ['.env.local','.env']) if(existsSync(file)) process.loadEnvFile(file);
if(!process.env.OPENAI_API_KEY) throw Error('OPENAI_API_KEY is unavailable. No live call made.');
/** Explicit billable integration check. Isolates progress from the published demo.
 * Actual browser, backend, GPT-Live and Responses; simulated microphone input. */
const proof:any={ result:'UNVERIFIED', simulatedMicrophone:true, actualOpenAI:false, api:[],uiRequests:[],turns:[], requirements: {}, startedAt:new Date().toISOString() };
const questions=['How can a lens in eyeglasses bend light, and how does that connect to this water lesson?', 'How is that bending in eyeglasses connected to the change of material you just mentioned?'];
await mkdir(resolve('.task-tmp'),{recursive:true}); await mkdir(resolve('docs/screenshots'),{recursive:true});
const folder=await mkdtemp(resolve('.task-tmp/single-avatar-live-'));
const publishedFolder=resolve(process.env.COTEACHER_DELIVERY_DIR ?? '.coteacher-delivery');
const published=JSON.parse(await readFile(resolve(publishedFolder,'published.json'),'utf8'));
if(!/^[a-f0-9]{64}$/.test(published.audioId)) throw Error('Invalid published recording identifier');
await copyFile(resolve(publishedFolder,'published.json'),resolve(folder,'published.json'));
await copyFile(resolve(publishedFolder,published.audioId+'.ogg'),resolve(folder,published.audioId+'.ogg'));
const wav=resolve('.task-tmp/avatar-live-student-question.wav');
const previousFixture=resolve('.task-tmp/avatar-test-question.wav');
if(existsSync(previousFixture)&&(await readFile(previousFixture)).length>46){
 await copyFile(previousFixture,wav);proof.microphoneFixture='Existing synthetic question fixture from the earlier live probe';
}else{
 execFileSync('powershell.exe',['-NoProfile','-Command','$voice=New-Object -ComObject SAPI.SpVoice; $stream=New-Object -ComObject SAPI.SpFileStream; $stream.Format.Type=22; $stream.Open($env:COTEACHER_PROBE_WAV,3); $voice.AudioOutputStream=$stream; [void]$voice.Speak($env:COTEACHER_PROBE_QUESTION); $stream.Close()'],{env:{...process.env,COTEACHER_PROBE_WAV:wav,COTEACHER_PROBE_QUESTION:questions[0]},stdio:'ignore',windowsHide:true});
 if((await readFile(wav)).length<=46)throw Error('Simulated microphone fixture is empty: Windows SAPI produced no speech. No OpenAI request made.');
}
const traced:typeof fetch=async (input,init)=>{
 const at=Date.now(),response=await fetch(input,init);
 const path=new URL(String(input)).pathname;
 const task=path==='/v1/responses'&&typeof init?.body==='string'?JSON.parse(JSON.parse(init.body).input):undefined;
 proof.api.push({path,status:response.status,requestId:response.headers.get('x-request-id'),durationMs:Date.now()-at,...(task?{question:task.question,historyQuestions:task.history.map((turn:any)=>turn.question)}:{})});
 if(response.ok)proof.actualOpenAI=true;
 console.log(JSON.stringify({stage:'provider',path,status:response.status,durationMs:Date.now()-at}));
 return response;
};
const server=await startDelivery(folder,0,'local-demo-publisher',new OpenAITutor(process.env.OPENAI_API_KEY,traced),new OpenAILiveVoice(process.env.OPENAI_API_KEY,traced));
const address=server.address(); if(!address||typeof address==='string') throw Error('Local test backend failed');
process.env.COTEACHER_DELIVERY_URL=`http://127.0.0.1:${address.port}`;
const app=await preview({root:resolve('apps/student'),configFile:resolve('apps/student/vite.config.ts'),preview:{host:'127.0.0.1',port:4393,strictPort:true,open:false}});
const browser=await chromium.launch({headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']});
const context=await browser.newContext({viewport:{width:1440,height:1100},permissions:['microphone'],serviceWorkers:'allow',reducedMotion:'reduce'});
const page=await context.newPage();
page.setDefaultTimeout(30000);
const deadline=setTimeout(()=>{ console.error('FAIL: tutoring probe exceeded its six-minute limit.'); void browser.close(); },360000);
const pageErrors:string[]=[]; page.on('pageerror',error=>pageErrors.push(error.message));
async function saved(id='student-a1b2c3d4',pin='111111'){const envelope=await page.evaluate(id=>new Promise<any>((resolve,reject)=>{const open=indexedDB.open('coteacher-sprint');open.onsuccess=()=>{const db=open.result,r=db.transaction('profiles').objectStore('profiles').get(id);r.onsuccess=()=>{db.close();resolve(r.result)};r.onerror=()=>reject(r.error)};}),id);return await decryptPayload(envelope,pin) as any;}
async function ask(text:string){const dock=page.getByRole('region',{name:'Coteacher lesson companion',exact:true});const composer=dock.getByLabel('Which part of this recorded concept is unclear?',{exact:true});if(!await composer.isVisible()){const menu=dock.getByRole('button',{name:'Ask or explore this concept',exact:true});if(await menu.getAttribute('aria-expanded')!=='true')await menu.click();const typeInstead=dock.getByRole('button',{name:'Type instead',exact:true});if(await typeInstead.isVisible())await typeInstead.click();}await expect(composer).toBeVisible();await composer.fill(text);await dock.getByRole('button',{name:'Ask Coteacher',exact:true}).click();}
async function unlock(id='student-a1b2c3d4',pin='111111'){await page.getByLabel('Your profile',{exact:true}).selectOption(id);await page.getByLabel('Six-digit PIN').fill(pin);await page.getByRole('button',{name:'Unlock my profile'}).click();}
async function openLesson(){await page.getByRole('button',{name:/Watch Now|Continue Watching|Watch Offline/,exact:true}).first().click();await expect(page.locator('.immersive-player')).toBeVisible();}
await page.route('**/__probe-question.wav',r=>r.fulfill({contentType:'audio/wav',headers:{'Access-Control-Allow-Origin':'*'},path:wav}));
await page.addInitScript(()=>{
 const w=window as any;w.liveProof={received:[],sent:[],microphones:[],lifecycle:[]};
 for(const name of ['offline','online','blur','pagehide'])window.addEventListener(name,()=>w.liveProof.lifecycle.push({event:name,at:Date.now(),online:navigator.onLine,hint:localStorage.getItem('coteacher-school-offline')}));
 document.addEventListener('visibilitychange',()=>w.liveProof.lifecycle.push({event:'visibilitychange',at:Date.now(),hidden:document.hidden,online:navigator.onLine}));
 const NativePeer=RTCPeerConnection;
 w.RTCPeerConnection=class extends NativePeer {
  constructor(config?:RTCConfiguration){super(config);w.liveProof.peer=this;const peer=this;setInterval(async()=>{try{const stats=await peer.getStats(),rtp:any[]=[];stats.forEach((s:any)=>{if(s.type.includes("rtp"))rtp.push({type:s.type,bytes:s.bytesSent??s.bytesReceived,packets:s.packetsSent??s.packetsReceived,energy:s.totalAudioEnergy})});w.liveProof.rtp=rtp}catch{}},500);}
  createDataChannel(label:string,options?:RTCDataChannelInit){const c=super.createDataChannel(label,options),send=c.send.bind(c);c.send=(v:any)=>{try{w.liveProof.sent.push(JSON.parse(v))}catch{}return send(v)};c.addEventListener('message',e=>{try{w.liveProof.received.push(JSON.parse(e.data))}catch{}});return c;}
 };
 const native=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
 navigator.mediaDevices.getUserMedia=async constraints=>{
  const actual=await native(constraints);actual.getTracks().forEach(t=>t.stop());
  const audio=new AudioContext({sampleRate:48000}),destination=audio.createMediaStreamDestination(); const noise=audio.createBuffer(1,48000,48000);const samples=noise.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=(Math.random()-.5)*.002;const room=audio.createBufferSource();room.buffer=noise;room.loop=true;room.connect(destination);room.start();await audio.resume();
  // The synthetic microphone fixture is cross-origin so the app's real service
  // worker cannot substitute its navigation fallback. Playwright fulfills only
  // this fixture; GPT-Live, tutor and school requests remain genuine.
  const response=await fetch('http://127.0.0.1:4394/__probe-question.wav');const buffer=await audio.decodeAudioData(await response.arrayBuffer());w.liveProof.microphones.push(...destination.stream.getTracks());w.liveProof.playQuestion=async()=>{const source=audio.createBufferSource();source.buffer=buffer;source.connect(destination);source.start();};
  return destination.stream;
 };
});
page.on('response',r=>{if(new URL(r.url()).pathname.startsWith('/api/tutor'))proof.uiRequests.push({path:new URL(r.url()).pathname,status:r.status()});});
try{
 await page.goto('http://127.0.0.1:4393');await page.getByLabel('Six-digit PIN').fill('111111');await page.getByRole('button',{name:'Unlock my profile'}).click();
 await expect(page.getByRole('button',{name:'Watch Now',exact:true})).toBeEnabled({timeout:30000});await page.getByRole('button',{name:'Watch Now',exact:true}).click();
 await expect(page.getByText('Saved on this device',{exact:true})).toBeVisible({timeout:30000});
 await page.locator('.chapters [data-concept-id="refraction"]').click();
 const player=page.locator('.immersive-player'),before=await player.boundingBox();
 await player.locator('audio').evaluate((a:HTMLAudioElement)=>a.play());
 await expect.poll(()=>player.locator('audio').evaluate((a:HTMLAudioElement)=>a.currentTime)).toBeGreaterThan(0);
 await page.screenshot({path:'docs/screenshots/tutoring-journey-before.png',fullPage:false});
 await page.getByRole('button',{name:'Talk with Coteacher',exact:true}).click();
 const dock=page.getByRole('region',{name:'Coteacher lesson companion',exact:true});await expect(dock).toBeVisible();
 const at=await player.locator('audio').evaluate((a:HTMLAudioElement)=>a.currentTime);
 expect(await player.locator('audio').evaluate((a:HTMLAudioElement)=>a.paused)).toBe(true);proof.requirements[2]='PASS';
 await expect(page.locator('.coteacher-avatar')).toHaveCount(1);await expect(page.getByRole('dialog')).toHaveCount(0);proof.requirements[1]='PASS';
 expect(await page.locator('[data-companion-audio]').evaluate((a:HTMLAudioElement)=>a.paused)).toBe(true);
 expect((await saved()).progress.queuedQuestions.length).toBe(0);
 await expect(page.locator('.companion-lesson-tools')).toHaveCount(0);
 await page.getByLabel('Enable connected tutoring and learning memory').check();
 await expect(dock.getByRole('button',{name:'Start live conversation',exact:true})).toBeEnabled({timeout:45000});
 await dock.getByRole('button',{name:'Start live conversation',exact:true}).click();
 await page.waitForFunction(()=> (window as any).liveProof.received.some((e:any)=>e.type==='session.started') || document.querySelector('.companion-caption')?.textContent?.includes('failed'),undefined,{timeout:45000});
 const started=await page.evaluate(()=> (window as any).liveProof.received.some((e:any)=>e.type==='session.started'));
 if(!started) throw Error(await dock.locator('.companion-caption').innerText());
 await page.waitForFunction(()=> (window as any).liveProof.received.filter((e:any)=>e.type==='session.output_transcript.delta').map((e:any)=>e.delta).join('').toLowerCase().match(/problem|struggling|listening|unclear/),undefined,{timeout:30000});
 proof.greeting=await page.evaluate(()=> (window as any).liveProof.received.filter((e:any)=>e.type==='session.output_transcript.delta').map((e:any)=>e.delta).join(''));
 expect((await saved()).progress.queuedQuestions.length).toBe(0);
 expect(await page.locator('[data-companion-audio]').evaluate((a:HTMLAudioElement)=>a.paused)).toBe(true);proof.requirements[3]='PASS';
 await expect.poll(()=>page.evaluate(async()=>{const stats=await (window as any).liveProof.peer.getStats();let energy=0;stats.forEach((s:any)=>{if(s.type==='inbound-rtp'&&(s.kind==='audio'||s.mediaType==='audio'))energy+=s.totalAudioEnergy??0});return energy}),{timeout:20000}).toBeGreaterThan(.001); proof.greetingSpoken=true; proof.recordingPausedAt=at;
 await page.evaluate(()=> (window as any).liveProof.playQuestion());
 await expect.poll(async()=> (await saved()).tutor?.replies?.filter((r:any)=>r.status==='answered').length??0,{timeout:150000}).toBeGreaterThan(0);
 const first=(await saved()).tutor.replies.find((r:any)=>r.status==='answered');
 proof.turns.push({mode:'spoken',question:first.originalText,answer:first.text,sourceRefs:first.sourceRefs,citations:first.citations});
 expect(first.engine).toBe('openai');expect(first.sourceRefs.length).toBeGreaterThan(0);expect(first.conceptId).toBe('refraction');expect(first.positionMs).toBe(Math.round(at*1000));proof.requirements[4]='PASS';
 await expect.poll(()=>page.evaluate(()=> (window as any).liveProof.sent.some((e:any)=>e.type==='session.commentary.append'&&e.delegation_id!==null)),{timeout:20000}).toBe(true);
 await page.waitForFunction(()=> (window as any).liveProof.received.filter((e:any)=>e.type==='session.output_transcript.delta').map((e:any)=>e.delta).join('').toLowerCase().match(/make.*sense|understand|quick check/),undefined,{timeout:60000});
 proof.requirements[7]='PASS';
 await dock.getByRole('button',{name:'Ask or explore this concept',exact:true}).click();
 const input=dock.getByLabel('Which part of this recorded concept is unclear?',{exact:true});await input.fill(questions[1]);
 await dock.getByRole('button',{name:'Ask Coteacher',exact:true}).click();
 await expect.poll(async()=> (await saved()).tutor?.replies?.filter((r:any)=>r.status==='answered').length??0,{timeout:45000}).toBe(2);
 const second=(await saved()).tutor.replies.find((r:any)=>r.originalText===questions[1]);
 proof.turns.push({mode:'typed-in-same-live-session',question:second.originalText,answer:second.text,sourceRefs:second.sourceRefs,citations:second.citations});
 expect(second.engine).toBe('openai');expect(second.sourceRefs.length).toBeGreaterThan(0);expect(second.positionMs).toBe(first.positionMs);proof.requirements[6]='PASS';
 expect(proof.api.find((request:any)=>request.question===questions[1]).historyQuestions).toContain(first.originalText);
 await expect.poll(()=>page.evaluate(()=> (window as any).liveProof.sent.filter((e:any)=>e.type==='session.commentary.append').length),{timeout:20000}).toBeGreaterThanOrEqual(3);
 await page.waitForTimeout(7000);
 proof.decodedAudio=await page.evaluate(async()=>{const p=(window as any).liveProof,stats=await p.peer.getStats(),incoming:any[]=[];stats.forEach((s:any)=>{if(s.type==='inbound-rtp'&&(s.kind==='audio'||s.mediaType==='audio'))incoming.push({bytes:s.bytesReceived,energy:s.totalAudioEnergy,samplesDuration:s.totalSamplesDuration});});return {incoming,time:(document.querySelector('[data-live-companion-audio]') as HTMLAudioElement).currentTime,paused:(document.querySelector('[data-live-companion-audio]') as HTMLAudioElement).paused};});
 expect(proof.decodedAudio.incoming.some((s:any)=>s.energy>.001)).toBe(true);
 expect(proof.decodedAudio.paused).toBe(false);expect(await page.locator('[data-live-companion-audio]').evaluate((audio:HTMLAudioElement)=>audio.muted)).toBe(false);proof.requirements[5]='PASS';
 expect((await player.boundingBox())!.width).toBe(before!.width);expect((await player.boundingBox())!.height).toBe(before!.height);
 expect(await player.locator('audio').evaluate((a:HTMLAudioElement)=>a.currentTime)).toBeCloseTo(at,2);
 await page.screenshot({path:'docs/screenshots/single-avatar-live-desktop.png',fullPage:false});
 await page.setViewportSize({width:360,height:800});await player.evaluate(el=>window.scrollTo(0,scrollY+el.getBoundingClientRect().top-140));await page.screenshot({path:'docs/screenshots/single-avatar-live-mobile.png',fullPage:false});
 proof.live=await page.evaluate(()=>{const p=(window as any).liveProof;return{sessionIds:p.received.filter((e:any)=>e.type==='session.started').map((e:any)=>e.session?.id),input:p.received.filter((e:any)=>e.type==='session.input_transcript.delta').map((e:any)=>e.delta).join(''),output:p.received.filter((e:any)=>e.type==='session.output_transcript.delta').map((e:any)=>e.delta).join(''),errors:p.received.filter((e:any)=>e.type==='error'||e.type==='session.error'),sentTypes:p.sent.map((e:any)=>e.type),delegations:p.received.filter((e:any)=>e.type==='session.delegation.created').map((e:any)=>e.delegation?.id)}});
 expect(proof.live.sessionIds.length).toBe(1);expect(proof.live.errors).toEqual([]);
 await dock.getByRole('button',{name:'It makes sense now',exact:true}).click();
 await expect(dock.getByRole('button',{name:'Try a quick check',exact:true})).toBeVisible();
 await dock.getByRole('button',{name:'Try a quick check',exact:true}).click();
 const quiz=(await saved()).lesson.quiz.find((q:any)=>q.conceptId==='refraction');
 await expect(page.locator('.companion-learning-task .quiz-card')).toBeVisible();
 await page.getByRole('button',{name:quiz.options[quiz.correctIndex],exact:true}).click();
 await expect(page.locator('.companion-learning-task .quiz-feedback')).toContainText('Nice thinking!');
 await expect.poll(async()=> (await saved()).progress.events.some((e:any)=>e.type==='quiz-answered'&&e.quizId===quiz.id&&e.correctness)).toBe(true);proof.requirements[8]='PASS';
 await expect.poll(()=>page.evaluate(()=> (window as any).liveProof.microphones.every((t:MediaStreamTrack)=>t.readyState==='ended'))).toBe(true);
 await player.locator('audio').evaluate((audio:HTMLAudioElement)=>audio.addEventListener('play',()=>{ (window as any).resumedAt=audio.currentTime; },{once:true}));
 await dock.getByRole('button',{name:'Return to recorded lesson',exact:true}).click();await expect(dock).toHaveCount(0);await expect.poll(()=>player.locator('audio').evaluate((a:HTMLAudioElement)=>!a.paused)).toBe(true);
 expect(await page.evaluate(()=> (window as any).resumedAt)).toBeCloseTo(at,2);proof.requirements[9]='PASS';
 await player.locator('audio').evaluate((a:HTMLAudioElement)=>a.pause());
 proof.requirements[10]=proof.api.some((r:any)=>r.path==='/v1/live/sessions'&&r.status===201)&&proof.api.filter((r:any)=>r.path==='/v1/responses'&&r.status===200).length>=2?'PASS':'FAIL';
 expect(proof.requirements[10]).toBe('PASS');
 expect(pageErrors).toEqual([]);
 // Preserve the existing complete-download/offline/queue/reconnect journey.
 await page.getByRole('button',{name:'Download for offline use',exact:true}).click();
 await expect(page.getByText('Ready offline',{exact:true}).first()).toBeVisible({timeout:60000});
 await context.setOffline(true);await page.evaluate(()=>window.dispatchEvent(new Event('offline')));
 const apiBeforeOffline=proof.api.length;
 await page.reload();await unlock();await openLesson();
 await player.locator('audio').evaluate((audio:HTMLAudioElement)=>audio.play());
 await expect.poll(()=>player.locator('audio').evaluate((audio:HTMLAudioElement)=>!audio.paused&&audio.currentTime>0)).toBe(true);
 await player.locator('audio').evaluate((audio:HTMLAudioElement)=>audio.pause());
 await page.locator('.chapters [data-concept-id="refraction"]').click();
 await page.getByRole('button',{name:'Talk with Coteacher',exact:true}).click();
 expect(await page.locator('[data-companion-audio]').evaluate((audio:HTMLAudioElement)=>audio.paused)).toBe(true);
 await ask('Why does the pencil look broken?');
 await expect.poll(async()=> (await saved()).progress.events.some((e:any)=>e.type==='question-matched'&&e.originalText==='Why does the pencil look broken?')).toBe(true);
 await expect.poll(()=>page.locator('[data-companion-audio]').evaluate((audio:HTMLAudioElement)=>!audio.paused&&audio.currentTime>0)).toBe(true);
 const pending='How does a telescope lens bend light like this water lesson?';await ask(pending);
 await expect.poll(async()=> (await saved()).progress.queuedQuestions.some((q:any)=>q.text===pending)).toBe(true);
 const queued=(await saved()).progress.queuedQuestions.find((q:any)=>q.text===pending);
 await page.reload();await unlock();await openLesson();
 expect((await saved()).progress.queuedQuestions.find((q:any)=>q.id===queued.id)).toEqual(queued);
 expect(proof.api.length).toBe(apiBeforeOffline);proof.offline={result:'PASS',preparedAnswer:true,actualLocalAudio:true,queuedQuestionId:queued.id,restart:true,noProviderRequests:true};
 await context.setOffline(false);await page.evaluate(()=>window.dispatchEvent(new Event('online')));
 await expect.poll(async()=> (await saved()).tutor?.replies.find((r:any)=>r.questionId===queued.id)?.status,{timeout:90000}).toBe('answered');
 await expect.poll(async()=> (await saved()).sync?.questionIds.includes(queued.id),{timeout:30000}).toBe(true);
 const received=JSON.parse(await readFile(resolve(folder,'progress-student-a1b2c3d4.json'),'utf8'));
 const schoolRecord=await decryptPayload(received,'111111') as any;
 expect(schoolRecord.progress.queuedQuestions.filter((q:any)=>q.id===queued.id)).toHaveLength(1);
 proof.reconnect={result:'PASS',acknowledged:true,returnedRealAI:true,noDuplicateQuestion:true,teacherReceived:true};
 // The second fictional learner must neither inherit A's questions nor silently
 // opt in to an external provider by submitting a typed question.
 await page.getByRole('button',{name:'Lock / switch learner',exact:true}).click();await unlock('student-b1c2d3e4','222222');await openLesson();
 await page.locator('.chapters [data-concept-id="refraction"]').click();await page.getByRole('button',{name:'Talk with Coteacher',exact:true}).click();
 await dock.getByRole('button',{name:'Type instead',exact:true}).click();
 const callsBeforeConsent=proof.api.length;const bQuestion='How do lenses use this boundary?';await ask(bQuestion);
 await expect.poll(async()=> (await saved('student-b1c2d3e4','222222')).progress.queuedQuestions.some((q:any)=>q.text===bQuestion)).toBe(true);
 expect((await saved('student-b1c2d3e4','222222')).tutor?.enabled??false).toBe(false);
 await page.waitForTimeout(2000);expect(proof.api.length).toBe(callsBeforeConsent);
 expect((await saved('student-b1c2d3e4','222222')).progress.queuedQuestions.some((q:any)=>q.id===queued.id)).toBe(false);
 expect((await saved()).progress.queuedQuestions.some((q:any)=>q.text===bQuestion)).toBe(false);
 proof.profileIsolation={result:'PASS',textConsentRespected:true};
 proof.result='PASS'; proof.scope='Actual student player + Node backend + real GPT-Live WebRTC + Responses + generated speech, first turn simulated microphone input, second turn typed in same live session. Isolated school records. Not a physical microphone test.';
}catch(error){proof.result='FAIL';proof.error=(error as Error).message;proof.uiText=await page.locator('body').innerText().catch(()=> '');proof.live=await page.evaluate(()=>{const p=(window as any).liveProof;return p?{received:p.received,sent:p.sent,rtp:p.rtp,lifecycle:p.lifecycle,online:navigator.onLine,hint:localStorage.getItem('coteacher-school-offline')}:null}).catch(()=>null);await page.screenshot({path:'.task-tmp/single-avatar-live-failure.png',fullPage:true}).catch(()=>{});throw error;
}finally{
 clearTimeout(deadline);
 proof.finishedAt=new Date().toISOString();
 await writeFile('docs/tutoring-journey-live-evidence.json',JSON.stringify(proof,null,2));console.log(JSON.stringify({result:proof.result,error:proof.error,api:proof.api,greeting:proof.greeting,turns:proof.turns.length,requirements:proof.requirements}));
 await browser.close();server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));if('closeAllConnections' in app.httpServer)app.httpServer.closeAllConnections();await new Promise<void>(r=>app.httpServer.close(()=>r()));
}
