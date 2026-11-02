import { test,expect,type Page } from '@playwright/test';
import { demoLessons,decryptPayload } from '@coteacher/shared';
import { writeFile } from 'node:fs/promises';
test.setTimeout(180000);
test.use({actionTimeout:15000});
const firstTitle='Why does a pencil look bent in water?',secondTitle='Refraction: revisit and check the light path';
async function signIn(page:Page,email:string){
  const online=page.getByRole('button',{name:'Open online school library',exact:true});
  await expect(online.or(page.getByLabel('Email or school-issued username',{exact:true}))).toBeVisible();
  if(await online.isVisible())await online.click();
  await page.getByLabel('Email or school-issued username',{exact:true}).fill(email);
  await page.getByLabel('Password',{exact:true}).fill('fictional-password-123');await page.getByRole('button',{name:'Sign in',exact:true}).click();
}
async function openLesson(page:Page,title:string,pin:string){
  const card=page.locator('.lesson-card').filter({has:page.getByRole('heading',{name:title,exact:true})});
  await card.getByRole('button',{name:'Watch lesson',exact:true}).click();await card.getByLabel('Device PIN (six digits)').fill(pin);
  await card.getByRole('button',{name:'Open my lesson',exact:true}).click();await expect(page.locator('.recorded-lesson audio')).toBeAttached();
  await expect(page.getByText('Saved on this device',{exact:true})).toBeVisible();
}
async function download(page:Page){await page.getByRole('button',{name:'Download for offline use',exact:true}).click();await expect(page.getByText('Download complete',{exact:true})).toBeVisible();await expect(page.getByText('Ready offline',{exact:true})).toBeVisible();await expect(page.getByText('Saved on this device',{exact:true})).toBeVisible();}
async function help(page:Page){
  await page.locator('.chapters [data-concept-id="refraction"]').click();await page.getByRole('button',{name:'Talk with Coteacher',exact:true}).click();
  if(await page.getByRole('button',{name:'Type instead',exact:true}).isVisible())await page.getByRole('button',{name:'Type instead',exact:true}).click();
  const tools=page.getByRole('button',{name:'Ask or explore this concept',exact:true});
  if(await tools.getAttribute('aria-expanded')==='true')await tools.click();
  await page.getByText('Approved alternatives',{exact:true}).click();
}
async function ask(page:Page,text:string){
  const tools=page.getByRole('button',{name:'Ask or explore this concept',exact:true});
  if(await tools.getAttribute('aria-expanded')!=='true')await tools.click();
  await page.getByLabel('Which part of this recorded concept is unclear?',{exact:true}).fill(text);await page.getByRole('button',{name:'Ask Coteacher',exact:true}).click();
}
async function signOut(page:Page){
  await page.getByRole('button',{name:'Lock / switch learner'}).click();
  if(await page.getByRole('button',{name:'Open online school library'}).isVisible())await page.getByRole('button',{name:'Open online school library'}).click();
  await page.getByRole('button',{name:'Profile',exact:true}).click();
  const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/v1/logout' && r.request().method()==='POST');
  const loaded=page.waitForEvent('load');
  await page.getByRole('button',{name:'Sign out',exact:true}).click();expect((await response).ok()).toBe(true);await loaded;
}
async function privateDecisions(page:Page,learnerId:string,pin:string){
  const envelope=await page.evaluate(id=>new Promise<unknown>((resolve,reject)=>{const opening=indexedDB.open('coteacher-sprint');opening.onsuccess=()=>{const db=opening.result,q=db.transaction('learning').objectStore('learning').get(id);q.onsuccess=()=>{db.close();resolve(q.result);};q.onerror=()=>reject(q.error);};}),learnerId);
  if(!envelope)return [];
  const memory=await decryptPayload(envelope,pin) as {decisions?:{id:string;selectionId:string;learnerId:string;selectedVisualId:string;evidenceIds:string[];model:{modelVersion:string;status:string;confidence:number;sampleCount:number;calibration:string}}[]};
  return memory.decisions??[];
}
async function selectRecommended(page:Page){
  const alternatives=page.locator('details.companion-more').filter({has:page.getByText('Approved alternatives',{exact:true})});
  if(!await alternatives.evaluate(node=>node.hasAttribute('open')))await alternatives.getByText('Approved alternatives',{exact:true}).click();
  await alternatives.getByRole('button',{name:'Try recommended visual',exact:true}).click();
}
test('two fictional learners adapt across two reviewed lessons, reopen offline, switch privately and sync without duplicate evidence',async({page,context,browser},info)=>{
  // Hold the first progress return until the learner has finished locally.
  // Completion must wait for the actual server acknowledgement, not race it.
  let releaseProgress!:()=>void,progressReleased=false,progressAcknowledged=false;
  const progressGate=new Promise<void>(resolve=>{releaseProgress=resolve;});
  const prematureCompletions:string[]=[];
  page.once('close',()=>releaseProgress());
  page.on('response',response=>{if(response.request().method()==='POST' && new URL(response.url()).pathname.endsWith('/progress') && response.status()===200)progressAcknowledged=true;});
  page.on('request',request=>{if(request.method()==='POST' && new URL(request.url()).pathname.endsWith('/learning') && !progressAcknowledged)prematureCompletions.push('completion-before-progress-receipt');});
  await page.route('**/api/v1/lessons/*/progress',async route=>{
    if(route.request().method()==='POST' && !progressReleased)await progressGate;
    await route.continue().catch(()=>{}); // A superseded request may already be aborted.
  });
  const apiErrors:string[]=[];page.on('pageerror',e=>apiErrors.push(e.message));
  await page.goto('http://127.0.0.1:4273/');await signIn(page,'student@fictional.invalid');await openLesson(page,firstTitle,'111111');
  await expect(page.locator('.watch-page')).toHaveClass(/larger-learning-text/);
  await expect(page.locator('figure.replay-stage')).toHaveAttribute('data-visual-asset-id','light-path-diagram');
  await expect(page.getByRole('combobox',{name:'Playback speed',exact:true})).toHaveValue('0.75');
  await download(page);await help(page);
  const learnerA=await page.evaluate(()=>JSON.parse(localStorage.getItem('coteacher-school-downloads-v1')!)[0].learnerId as string);
  await expect(page.locator('[data-recommended-visual-id]')).toHaveAttribute('data-recommended-visual-id','refraction-pencil');
  await page.locator('.companion-more').getByRole('button',{name:'Quick check',exact:true}).click();
  const quiz=demoLessons()[0].quiz.find(q=>q.conceptId==='refraction')!;
  await page.getByRole('button',{name:quiz.options[(quiz.correctIndex+1)%quiz.options.length],exact:true}).click();
  await expect(page.locator('.quiz-feedback')).toContainText('1 saved attempt');
  await page.getByRole('button',{name:'Back to our conversation',exact:true}).click();
  await expect(page.locator('[data-recommended-visual-id]')).toHaveAttribute('data-recommended-visual-id','refraction-steps');
  await selectRecommended(page);
  await expect(page.getByText('Saved on this device',{exact:true})).toBeVisible();
  await expect.poll(async()=>(await privateDecisions(page,learnerA,'111111')).length).toBe(1);
  const firstDecision=(await privateDecisions(page,learnerA,'111111'))[0];
  expect(firstDecision).toMatchObject({learnerId:learnerA,selectedVisualId:'refraction-steps',model:{modelVersion:'bayesian-evidence-count-v1',status:'abstain',sampleCount:1,calibration:'unvalidated'}});
  expect(firstDecision.model.confidence).toBeCloseTo(1/11);
  expect(firstDecision.evidenceIds).not.toContain(firstDecision.selectionId);
  expect(firstDecision.evidenceIds.some(id=>id.endsWith(':'+firstDecision.selectionId))).toBe(false);
  // The recommendation uses assessment evidence; clicking it is an explicit choice.
  expect(firstDecision).toMatchObject({basis:'explicit-choice',evidenceIds:[]});
  await expect(page.locator('body')).not.toContainText('bayesian-evidence-count-v1');
  await page.getByRole('button',{name:'Return to recorded lesson',exact:true}).click();
  await page.getByRole('button',{name:'Finish this lesson',exact:true}).click();await page.getByRole('button',{name:'Dismiss preference prompt'}).click();
  await expect(page.getByText('Saved on this device',{exact:true})).toBeVisible();
  expect(prematureCompletions).toEqual([]);progressReleased=true;releaseProgress();
  await expect(page.getByText('School received your progress.',{exact:true})).toBeVisible({timeout:30000});
  expect(progressAcknowledged).toBe(true);expect(prematureCompletions).toEqual([]);
  await signOut(page);await signIn(page,'outsider@fictional.invalid');await openLesson(page,firstTitle,'222222');await expect(page.locator('figure.replay-stage')).toHaveAttribute('data-visual-asset-id','light-path-steps');await download(page);await help(page);
  await expect(page.locator('[data-recommended-visual-id]')).toHaveAttribute('data-recommended-visual-id','refraction-steps');
  await page.locator('.companion-more').getByRole('button',{name:'Quick check',exact:true}).click();await page.getByRole('button',{name:quiz.options[quiz.correctIndex],exact:true}).click();
  await page.getByRole('button',{name:'Back to our conversation',exact:true}).click();await selectRecommended(page);await page.getByRole('button',{name:'Return to recorded lesson',exact:true}).click();
  await page.getByRole('button',{name:'Finish this lesson',exact:true}).click();
  await page.getByRole('button',{name:'Lock / switch learner'}).click();await openLesson(page,secondTitle,'222222');await download(page);await help(page);
  await expect(page.locator('[data-recommended-visual-id]')).toHaveAttribute('data-recommended-visual-id','refraction-steps');
  await expect(page.locator('[data-recommended-visual-id]')).not.toContainText('recent check');
  await page.getByRole('button',{name:'Return to recorded lesson',exact:true}).click();await signOut(page);
  await signIn(page,'student@fictional.invalid');await openLesson(page,secondTitle,'111111');await download(page);await help(page);
  await expect(page.locator('[data-recommended-visual-id]')).toHaveAttribute('data-recommended-visual-id','refraction-steps');
  await expect(page.locator('[data-recommended-visual-id]')).toContainText('recent check');
  await selectRecommended(page);
  await page.getByRole('button',{name:'Return to recorded lesson',exact:true}).click();
  await expect(page.getByText('Saved on this device',{exact:true})).toBeVisible();
  const beforeOfflineDecisions=await privateDecisions(page,learnerA,'111111');expect(beforeOfflineDecisions.length).toBeGreaterThanOrEqual(2);
  // Offline collection/reopening is a real browser interaction. The audio fixture and preparation provider are simulated.
  await context.addInitScript(()=>{
    (window as any).__offlineApiCalls=0;const original=window.fetch.bind(window);
    window.fetch=(input,init)=>{const path=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.href).pathname;if(localStorage.getItem('test-learning-offline')==='true' && path.startsWith('/api/')){(window as any).__offlineApiCalls++;throw new Error('Offline learning attempted an API call');}return original(input,init);};
  });
  await page.evaluate(()=>localStorage.setItem('test-learning-offline','true'));await context.setOffline(true);await page.reload();
  const second=page.locator(`form.offline-unlock[data-saved-learner-id="${learnerA}"]`).filter({has:page.getByRole('heading',{name:secondTitle,exact:true})});
  await second.getByLabel('Device PIN',{exact:true}).fill('111111');await second.getByRole('button',{name:'Unlock saved lesson'}).click();
  const audio=page.locator('.recorded-lesson audio');await expect.poll(()=>audio.evaluate((a:HTMLAudioElement)=>Number.isFinite(a.duration))).toBe(true);
  await audio.evaluate((a:HTMLAudioElement)=>a.play());await expect.poll(()=>audio.evaluate((a:HTMLAudioElement)=>a.currentTime)).toBeGreaterThan(.2);await audio.evaluate((a:HTMLAudioElement)=>a.pause());
  expect((await privateDecisions(page,learnerA,'111111')).map(d=>d.id)).toEqual(beforeOfflineDecisions.map(d=>d.id));
  await help(page);await expect(page.locator('svg[data-reduced-motion=true]').first()).toBeVisible();
  const candidate='What should I understand about refraction at the water surface?';
  const prepared=await page.evaluate(async()=>{const r=indexedDB.open('coteacher-sprint');return await new Promise<number>(resolve=>{r.onsuccess=()=>{const db=r.result;const q=db.transaction('profiles').objectStore('profiles').count();q.onsuccess=()=>{db.close();resolve(q.result);};};});});expect(prepared).toBe(4);
  await ask(page,candidate);
  await page.getByText('Read answer & sources',{exact:true}).click();
  await expect(page.locator('.player-questions')).toContainText('Prepared offline answer');
  // The actual generated candidate wording is derived from the approved title; unknown wording must remain no-match.
  await ask(page,'How does a rainbow form above a city?');
  await expect(page.locator('.player-questions')).toContainText('How does a rainbow form above a city?');
  await page.getByRole('button',{name:'Return to recorded lesson',exact:true}).click();await expect(page.getByText('Saved on this device',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>(window as any).__offlineApiCalls)).toBe(0);
  await page.screenshot({path:info.outputPath('cross-lesson-offline-desktop.png'),fullPage:true});
  await page.setViewportSize({width:360,height:800});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('cross-lesson-offline-mobile.png'),fullPage:true});
  await page.getByRole('button',{name:'Lock / switch learner'}).click();
  const firsts=page.locator('form.offline-unlock').filter({has:page.getByRole('heading',{name:firstTitle,exact:true})});await expect(firsts).toHaveCount(2);
  const b=firsts.nth(1);await b.getByLabel('Device PIN',{exact:true}).fill('222222');await b.getByRole('button',{name:'Unlock saved lesson'}).click();await help(page);
  await expect(page.getByText('How does a rainbow form above a city?',{exact:true})).toHaveCount(0);expect(await page.evaluate(()=>(window as any).__offlineApiCalls)).toBe(0);
  await page.getByRole('button',{name:'Lock / switch learner'}).click();await second.getByLabel('Device PIN',{exact:true}).fill('111111');await second.getByRole('button',{name:'Unlock saved lesson'}).click();
  await page.evaluate(()=>localStorage.removeItem('test-learning-offline'));await context.setOffline(false);await page.getByRole('button',{name:'Check school connection',exact:true}).click();
  await expect(page.getByText('School received your progress.',{exact:true})).toBeVisible({timeout:30000});expect(apiErrors).toEqual([]);
  const entries=await page.evaluate(()=>JSON.parse(localStorage.getItem('coteacher-school-downloads-v1')!) as {key:string;lessonId:string;title:string}[]);
  const active=entries.find(e=>e.title===secondTitle && e.key.startsWith(learnerA+':'))!;
  const contextResult=await page.request.get(`http://127.0.0.1:4273/api/v1/lessons/${active.lessonId}/learning`);expect(contextResult.ok()).toBe(true);
  const learning=await contextResult.json();
  expect(new Set(learning.memory.evidence.map((e:any)=>e.id)).size).toBe(learning.memory.evidence.length);
  const afterReconnectDecisions=await privateDecisions(page,learnerA,'111111');
  expect(afterReconnectDecisions.some(d=>d.id===firstDecision.id)).toBe(true);
  const envelope=await page.evaluate(key=>new Promise<unknown>((resolve,reject)=>{const opening=indexedDB.open('coteacher-sprint');opening.onsuccess=()=>{const db=opening.result,r=db.transaction('profiles').objectStore('profiles').get(key);r.onsuccess=()=>{db.close();resolve(r.result);};r.onerror=()=>reject(r.error);};}),active.key);
  const stored=await decryptPayload(envelope,'111111') as {learning:{memoryRef:{learnerId:string};memory?:unknown};progress:{events:unknown[]}};
  expect(stored.learning.memory).toBeUndefined();expect(stored.learning.memoryRef.learnerId).toBe(learnerA);
  await page.getByRole('button',{name:'Lock / switch learner'}).click();await page.getByRole('button',{name:'Open online school library',exact:true}).click();
  await page.getByRole('button',{name:'Profile',exact:true}).click();await page.getByRole('button',{name:'My learning preferences',exact:true}).click();
  await page.getByRole('button',{name:'Withdraw authorization and remove my answers'}).click();await expect(page.getByRole('status')).toContainText('removed on this device');
  const memoryOwners=await page.evaluate(()=>new Promise<IDBValidKey[]>((resolve,reject)=>{const r=indexedDB.open('coteacher-sprint');r.onsuccess=()=>{const db=r.result,q=db.transaction('learning').objectStore('learning').getAllKeys();q.onsuccess=()=>{db.close();resolve(q.result);};q.onerror=()=>reject(q.error);};}));
  expect(memoryOwners).not.toContain(learnerA);expect(memoryOwners).toHaveLength(1);
  await page.evaluate(()=>localStorage.setItem('test-learning-offline','true'));await context.setOffline(true);
  await second.getByLabel('Device PIN',{exact:true}).fill('111111');await second.getByRole('button',{name:'Unlock saved lesson'}).click();
  await expect(page.locator('.watch-page')).not.toHaveClass(/larger-learning-text/);await help(page);
  await expect(page.locator('[data-recommended-visual-id]')).toHaveAttribute('data-recommended-visual-id','refraction-steps');
  await expect(page.locator('[data-recommended-visual-id]')).toContainText('you chose');
  expect(await privateDecisions(page,learnerA,'111111')).toEqual([]);
  await expect(page.locator('.player-questions')).toContainText('How does a rainbow form above a city?');expect(await page.evaluate(()=>(window as any).__offlineApiCalls)).toBe(0);
  const report={simulated:true,result:'PASS',createdAt:new Date().toISOString(),learners:2,lessons:2,downloadedProfiles:prepared,offlineApiCalls:0,sharedDeviceIsolation:'PASS',assessmentDrivenCrossLessonSupport:'PASS',preparedGeneratedAnswer:'PASS',unsupportedQuestionQueued:'PASS',reconnectReceipt:'PASS',optionalMemoryClearedOnThisDevice:true,otherLearnerMemoryRetained:true,lessonAndProgressRetainedAfterWithdrawal:true,deduplicatedEvidence:learning.memory.evidence.length,preparedSupportBytes:Buffer.byteLength(JSON.stringify(learning.support)),externalProviderCalls:0,recording:'Synthetic Opus fixture; not human microphone verification',generation:'Mocked source-checked provider; real local/provider results are separate'};
  await writeFile('docs/student-learning-browser-evidence.json',JSON.stringify(report,null,2)+'\n');
});
