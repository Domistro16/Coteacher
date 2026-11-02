import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {approveLessons,demoLessons,emptyProgress,encryptPayload,decryptPayload} from '@coteacher/shared';
import {emptyPrivateMemory} from '../../packages/shared/src/learning-engine';
import {createPlayerModel,initialPlayerState} from '../../apps/student/src/player';

test('real encrypted progress download excludes separately encrypted private learning memory',async({page})=>{
  test.setTimeout(120000);
  const lesson=approveLessons(demoLessons(),true,new Date().toISOString())[0],id=lesson.studentId,pin='111111',marker='PRIVATE-EVIDENCE-EXPORT-7f62';
  const memory={...emptyPrivateMemory(id),personalization:true,preferences:{readingEase:'hard' as const},evidence:[{id:marker,lessonId:lesson.lessonId,subjectKey:'Science',knowledgeKey:'refraction',at:new Date().toISOString(),kind:'help' as const,sourceRefs:['notes-light']}]};
  const progress=emptyProgress(lesson),snapshot={lesson,progress,player:initialPlayerState(createPlayerModel(lesson)),learning:{memoryRef:{schemaVersion:'1.0.0',learnerId:id},support:null}};
  const profile=await encryptPayload(snapshot,pin),privateRow=await encryptPayload(memory,pin);
  await page.goto('/');
  // Fixture import exercises the genuine device read/save and download paths;
  // this is privacy plumbing, not evidence of learner/model performance.
  await page.evaluate(async({id,profile,privateRow})=>{await new Promise<void>((resolve,reject)=>{const r=indexedDB.open('coteacher-sprint',3);r.onupgradeneeded=()=>{for(const name of ['profiles','media','learning'])if(!r.result.objectStoreNames.contains(name))r.result.createObjectStore(name);};r.onsuccess=()=>{const db=r.result,tx=db.transaction(['profiles','learning'],'readwrite');tx.objectStore('profiles').put(profile,id);tx.objectStore('learning').put(privateRow,id);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};r.onerror=()=>reject(r.error);});},{id,profile,privateRow});
  await page.getByLabel('Six-digit PIN').fill(pin);await page.getByRole('button',{name:'Unlock my profile',exact:true}).click();
  await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Profile',exact:true}).click();
  await page.getByText('Bring progress to school / transfer lesson',{exact:true}).click();
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export my progress',exact:true}).click();
  const file=await download,envelope=JSON.parse(await readFile((await file.path())!,'utf8'));
  expect(JSON.stringify(envelope)).not.toContain(marker);await expect(decryptPayload(envelope,'222222')).rejects.toThrow();
  const exported=await decryptPayload(envelope,pin);expect(Object.keys(exported as object).sort()).toEqual(Object.keys(progress).sort());expect(JSON.stringify(exported)).not.toMatch(/PRIVATE-EVIDENCE|memoryRef|decisions|preferences|learning|nextCheckProbability/);
  const stored=await page.evaluate(()=>new Promise<{profiles:unknown[];learning:unknown[]}>((resolve,reject)=>{const r=indexedDB.open('coteacher-sprint');r.onsuccess=()=>{const db=r.result,tx=db.transaction(['profiles','learning']),a=tx.objectStore('profiles').getAll(),b=tx.objectStore('learning').getAll();tx.oncomplete=()=>{db.close();resolve({profiles:a.result,learning:b.result});};tx.onerror=()=>reject(tx.error);};}));
  expect(JSON.stringify(stored)).not.toContain(marker);expect(stored.learning).toHaveLength(1);
  expect((await decryptPayload(stored.learning[0],pin) as typeof memory).evidence[0].id).toBe(marker);
  const saved=await decryptPayload(stored.profiles[0],pin) as typeof snapshot;
  expect(saved.learning).toEqual({memoryRef:{schemaVersion:'1.0.0',learnerId:id},support:null});
  expect(await page.evaluate(()=>JSON.stringify({local:{...localStorage},session:{...sessionStorage}}))).not.toContain(marker);
  const cacheValues=await page.evaluate(async()=>{const values:string[]=[];for(const name of await caches.keys()){const c=await caches.open(name);for(const r of await c.keys()){const response=await c.match(r);if(response?.headers.get('content-type')?.includes('json'))values.push(await response.text());}}return values;});
  expect(JSON.stringify(cacheValues)).not.toContain(marker);
});
