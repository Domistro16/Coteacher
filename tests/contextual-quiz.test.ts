import { describe, it, expect } from 'vitest';
import { mkdtemp, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { emptyProgress, identifyProgressEvents, encryptPayload, decryptPayload, initialTutorState, validTutorState, checkPersonalization, mergeCheckAttempts, observedMemory, type TutorState, type TutorCheck, type TutorCheckRequest } from '@coteacher/shared';
import { LessonDeliveryStore } from '../delivery/store';
import { ProgressReturnStore } from '../delivery/progress-store';
import { TutorStore, checkedCheck, tutorSources } from '../delivery/tutor-store';
import { OpenAITutor, type CheckInput } from '../delivery/tutor-provider';
import { MockTutor, tutorPackages } from './tutor-fixture';

async function fixture() {
 const folder = await mkdtemp(resolve('.task-tmp/contextual-check-')), lessons = tutorPackages(), delivery = new LessonDeliveryStore(folder);
 await delivery.restore(); await delivery.publish(lessons);
 const progress = new ProgressReturnStore(folder, delivery), provider = new MockTutor(), tutor = new TutorStore(folder, progress, provider);
 const record = identifyProgressEvents(emptyProgress(lessons[0]));
 record.queuedQuestions.push({ id:'lens-question', text:'How does a curved lens bend light like water?', answered:false, askedAt:'2026-10-14T10:00:00Z', timelineStepId:'step-refraction', recordedContext:{studentId:record.studentId,lessonId:record.lessonId,recordingId:'tutor-recording',conceptId:'refraction',positionMs:1300} });
 record.events.push({type:'question-no-match',eventId:'asked-lens',questionId:'lens-question',conceptId:'refraction',timelineStepId:'step-refraction',timestamp:'2026-10-14T10:00:00Z',matcherScore:0});
 await tutor.submit(record.studentId,'tutor-recording',await encryptPayload({enabled:true,progress:record},'111111')); await tutor.idle();
 const request:TutorCheckRequest={enabled:true,questionId:'lens-question',originalText:record.queuedQuestions[0].text,positionMs:1300};
 const generate = async()=>await decryptPayload(await tutor.check(record.studentId,'tutor-recording',await encryptPayload(request,'111111')),'111111') as TutorState;
 return {folder,lessons,progress,record,provider,tutor,request,generate};
}

describe('question-grounded quick checks',()=>{
 it('derives support from actual attempts and explicit choices, with no invented history',()=>{
  const [lesson,other]=tutorPackages(), progress=emptyProgress(lesson), quiz=lesson.quiz.find(q=>q.conceptId==='refraction')!;
  expect(checkPersonalization(lesson,progress,'refraction')).toMatchObject({mode:'standard',evidenceEventIds:[],visualAssetId:null});
  progress.events.push({type:'quiz-answered',eventId:'wrong',conceptId:'refraction',quizId:quiz.id,selectedIndex:1,correctness:false,timestamp:'2026-10-14T10:00:00Z'});
  progress.events.push({type:'visual-explored',eventId:'chosen',origin:'learner-choice',conceptId:'refraction',timelineStepId:'step-refraction',recordingId:'tutor-recording',positionMs:1300,visualAssetId:'refraction-steps',sourceRefs:['notes-light'],timestamp:'2026-10-14T10:01:00Z'});
  expect(checkPersonalization(lesson,progress,'refraction')).toMatchObject({mode:'guided',evidenceEventIds:['wrong','chosen'],visualAssetId:'refraction-steps'});
  expect(checkPersonalization(other,emptyProgress(other),'refraction').mode).toBe('standard');
  for(let i=0;i<2;i++) progress.events.push({type:'quiz-answered',eventId:'right-'+i,conceptId:'refraction',quizId:quiz.id,selectedIndex:quiz.correctIndex,correctness:true,timestamp:`2026-10-14T10:0${i+2}:00Z`});
  expect(checkPersonalization(lesson,progress,'refraction').mode).toBe('application');
 });
 it('rejects invalid answer indices, duplicate options and invented source quotes',async()=>{
  const [lesson]=tutorPackages(),input:CheckInput={question:'Lens?',answer:'A lens bends passing light.',objective:lesson.objective.text,concept:'Refraction',classLevel:lesson.classLevel,sources:tutorSources(lesson,'refraction','lens'),history:[],observations:[],visuals:[],personalization:checkPersonalization(lesson,emptyProgress(lesson),'refraction'),representation:null,previousAttempts:[]};
  const provider=new MockTutor(),generated=await provider.check(input);
  expect(checkedCheck(generated,input)).not.toBeNull();
  expect(checkedCheck({...generated,correctIndex:9},input)).toBeNull();
  expect(checkedCheck({...generated,options:['Same','same']},input)).toBeNull();
  expect(checkedCheck({...generated,quotes:['A fabricated source quote']},input)).toBeNull();
  expect(checkedCheck({...generated,sourceIds:['invented']},input)).toBeNull();
 });
 it('generates for the exact question, persists encrypted context and immutable attempts, deduplicates and retains memory after restart',async()=>{
  const f=await fixture(),state=await f.generate(),check=state.checks![0];
  expect(check.originalText).toBe(f.request.originalText);expect(check.prompt).toContain('lens');expect(check.sourceRefs).toEqual(['nasa-spaceplace-lenses']);
  expect(validTutorState(state,f.lessons[0],f.record)).toBe(true);expect(validTutorState(state,f.lessons[1],emptyProgress(f.lessons[1]))).toBe(false);
  await f.generate();expect(f.provider.checkInputs).toHaveLength(1);
  const attempt={id:'attempt-1',checkId:check.id,selectedIndex:1,correctness:false,answeredAt:'2026-10-14T10:03:00Z'};
  for(let i=0;i<2;i++) await f.tutor.submit(f.record.studentId,'tutor-recording',await encryptPayload({enabled:true,progress:f.record,checkAttempts:[attempt]},'111111'));
  const updated=await decryptPayload(await f.tutor.returned(f.record.studentId,'tutor-recording'),'111111') as TutorState;
  expect(updated.checkAttempts).toEqual([attempt]);expect(updated.memory.observations.find(o=>o.eventId==='attempt-1')).toMatchObject({kind:'tutor-check-answered',detail:'Incorrect attempt'});
  await expect(f.tutor.submit(f.record.studentId,'tutor-recording',await encryptPayload({enabled:true,progress:f.record,checkAttempts:[{...attempt,selectedIndex:0,correctness:true}]},'111111'))).rejects.toThrow('changed');
  await expect(f.tutor.submit(f.record.studentId,'tutor-recording',await encryptPayload({enabled:true,progress:f.record,checkAttempts:[{...attempt,id:'invalid',correctness:true}]},'111111'))).rejects.toThrow('do not match');
  const retry=await f.generate();expect(retry.checks).toHaveLength(2);expect(retry.checks![1].personalization.mode).toBe('guided');expect(f.provider.checkInputs.at(-1)?.previousAttempts[0].selectedAnswer).toBe(check.options[1]);
  const restarted=new TutorStore(f.folder,f.progress,f.provider),restored=await restarted.current(f.record.studentId,'tutor-recording');expect(restored.checkAttempts).toEqual([attempt]);
  const bytes=await readFile(resolve(f.folder,'tutor-'+f.record.studentId+'.json'),'utf8');expect(bytes).not.toContain(f.request.originalText);expect(bytes).not.toContain('111111');
  expect(mergeCheckAttempts([],restored.checkAttempts)).toEqual([attempt]);
  const changed={...state,checks:[{...check,originalText:'A different question'}]};expect(validTutorState(changed,f.lessons[0],f.record)).toBe(false);
 },120000);
 it('does not accept another question identity, source failure or withdrawn consent',async()=>{
  const f=await fixture();
  await expect(f.tutor.check(f.record.studentId,'tutor-recording',await encryptPayload({...f.request,positionMs:1400},'111111'))).rejects.toThrow('original question');
  await expect(f.tutor.check(f.record.studentId,'tutor-recording',await encryptPayload({...f.request,originalText:'Different text'},'111111'))).rejects.toThrow('original question');
  f.provider.invalidCitation=true;await expect(f.generate()).rejects.toThrow('reliable source');
  await f.tutor.disable(f.record.studentId,'tutor-recording',await encryptPayload({enabled:false},'111111'));await expect(f.generate()).rejects.toThrow('Enable connected');
 },120000);
 it('sends question, objective, observed support and actual selected answers to the provider, and excludes the understanding prompt from check speech',async()=>{
  const requests:any[]=[];
  const transport:typeof fetch=async(url,options)=>{const body=JSON.parse(String(options?.body));requests.push({url:String(url),body});if(String(url).endsWith('/responses'))return new Response(JSON.stringify({output:[{content:[{type:'output_text',text:JSON.stringify({supported:false,confident:false,safe:true,prompt:'',options:['A','B'],correctIndex:0,explanation:'Unsupported',sourceIds:[],quotes:[]})}]}]}));return new Response(new Uint8Array([1,2,3]));};
  const provider=new OpenAITutor('test-key',transport),[lesson]=tutorPackages();
  const input:CheckInput={question:'How does a curved lens bend light?',answer:'A lens bends passing light.',objective:lesson.objective.text,concept:'Refraction',classLevel:lesson.classLevel,sources:tutorSources(lesson,'refraction','lens'),history:[],observations:[],visuals:[],personalization:{mode:'guided',reason:'An incorrect attempt was saved.',evidenceEventIds:['wrong'],visualAssetId:null},representation:null,previousAttempts:[{prompt:'What bends?',selectedAnswer:'The lens physically bends.',correctness:false}]};
  await provider.check(input);await provider.speak('What happens to light passing through a lens? Option one. It bends.',false);
  expect(requests[0].body.input.at(-1)).toEqual({role:'user',content:input.question});expect(requests[0].body.instructions).toContain('exact uncertainty');
  const context=JSON.parse(requests[0].body.input[0].content.split('(data): ')[1]);expect(context.previousAttempts).toEqual(input.previousAttempts);expect(context.personalization.mode).toBe('guided');expect(JSON.stringify(requests[0].body)).not.toContain('evidenceEventIds');
  expect(requests[1].body.input).not.toContain('Does that make more sense');expect(requests[1].body.voice).toBe('coral');
 });
});
