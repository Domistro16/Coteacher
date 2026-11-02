import { describe,it,expect } from 'vitest';
import { checkSchoolState,emptySchoolState,SchoolService } from '../delivery/school-store';
import { SchoolLessons } from '../delivery/school-lessons';
import { PreparationService } from '../delivery/preparation-service';
import { schoolFixture,schoolRecording } from './school-fixture';
import type { PrivateStorage } from '../delivery/private-storage';
import { MockTutor } from './tutor-fixture';
import { matchQuestion,emptyProgress,validateProgressRecord } from '@coteacher/shared';
async function setup(){
  let state=emptySchoolState();const school=new SchoolService({async transaction(work){const next=structuredClone(state);const output=await work(next);checkSchoolState(next);state=next;return output;}});
  const objects=new Map<string,Uint8Array>();const storage={put:async(key:string,bytes:Uint8Array)=>{objects.set(key,bytes);},get:async(key:string)=>objects.get(key)!,remove:async(key:string)=>{objects.delete(key);}} as unknown as PrivateStorage;
  const lessons=new SchoolLessons(school,storage);const provider=new MockTutor();const preparation=new PreparationService(school,lessons,storage,provider);lessons.preparedFor=(actor,id)=>preparation.current(actor,id);const f=await schoolFixture(school);
  const first=await lessons.publish(f.teacher.id,f.offerings[0].id,schoolRecording().lesson,false,true);
  const second=await lessons.publish(f.teacher.id,f.offerings[0].id,schoolRecording(true).lesson,false,true);
  return {...f,service:school,lessons,preparation,provider,first,second,objects};
}
describe('reviewed reusable preparation',()=>{
  it('generates reusable source-checked support without learner context, reviews it and matches downloaded candidates conservatively',async()=>{
    const f=await setup();const generated=await f.preparation.generate(f.teacher.id,f.first.id);
    expect(generated.candidates.some(c=>c.origin==='generated')).toBe(true);expect(f.provider.inputs).toHaveLength(2);
    for(const input of f.provider.inputs){expect(input.history).toEqual([]);expect(input.observations).toEqual([]);expect(input.teachingPreferences).toBeUndefined();}
    await f.preparation.generate(f.teacher.id,f.first.id);expect(f.provider.inputs).toHaveLength(2);
    await f.preparation.approve(f.teacher.id,f.first.id,{reviewed:true});const lesson=await f.lessons.package(f.student.id,f.first.id);
    const candidate=lesson.preparedSupport!.candidates.find(c=>c.origin==='generated' && c.conceptId==='refraction')!;
    const result=matchQuestion(candidate.question,'step-refraction',lesson);expect('match' in result && result.match.id).toBe(candidate.id);
    expect(matchQuestion(candidate.question+' rainbow syrup','step-refraction',lesson)).toHaveProperty('noMatch',true);
    const progress=emptyProgress(lesson);progress.events.push({type:'question-matched',eventId:'prepared-test',timestamp:new Date().toISOString(),conceptId:'refraction',timelineStepId:'step-refraction',questionId:candidate.id,matcherScore:1,originalText:candidate.question,recordedContext:{studentId:lesson.studentId,lessonId:lesson.lessonId,recordingId:lesson.recording!.id,conceptId:'refraction',positionMs:1300}});
    expect(validateProgressRecord(progress,lesson).valid).toBe(true);
  });
  it('prepares bounded sourced candidates once, requires review, and scopes reuse to authorized content',async()=>{
    const f=await setup();const draft=await f.preparation.draft(f.teacher.id,f.first.id);
    expect(draft.candidates.length).toBeGreaterThan(0);expect(draft.status).toBe('draft');
    expect(await f.preparation.current(f.student.id,f.first.id)).toBeNull();
    await expect(f.preparation.current(f.outsider.id,f.first.id)).rejects.toThrow('Authorized');
    await expect(f.preparation.approve(f.student.id,f.first.id,{reviewed:true})).rejects.toThrow('Authorized');
    await f.preparation.approve(f.teacher.id,f.first.id,{reviewed:true});
    const a=await f.preparation.current(f.student.id,f.first.id),b=await f.preparation.current(f.student.id,f.first.id);
    expect(a).toEqual(b);expect(a?.status).toBe('approved');expect(JSON.stringify(a)).not.toContain(f.student.id);
  });
  it('reviews explicit cross-lesson mappings without pooling subjects or accepting invented content',async()=>{
    const f=await setup();const a=await f.preparation.draft(f.teacher.id,f.first.id),b=await f.preparation.draft(f.teacher.id,f.second.id);
    expect(a.knowledge.concepts[0].knowledgeKey).not.toBe(b.knowledge.concepts[0].knowledgeKey);
    for(const [id,s] of [[f.first.id,a],[f.second.id,b]] as const){await f.preparation.approve(f.teacher.id,id,{reviewed:true,concepts:s.knowledge.concepts.map(c=>({...c,knowledgeKey:'reviewed:'+c.conceptId}))});}
    expect((await f.preparation.current(f.student.id,f.second.id))?.knowledge.concepts[0].knowledgeKey).toBe('reviewed:light-path');
    await expect(f.preparation.approve(f.teacher.id,f.first.id,{reviewed:true,concepts:[{conceptId:'made-up',knowledgeKey:'x',prerequisites:[],sourceRefs:['notes-light']}]})).rejects.toThrow('immutable');
  });
  it('keeps approved support immutable and rejects changed source instruction rather than reusing stale support',async()=>{
    const f=await setup();await f.preparation.draft(f.teacher.id,f.first.id);await f.preparation.approve(f.teacher.id,f.first.id,{reviewed:true});
    await expect(f.preparation.draft(f.teacher.id,f.first.id)).rejects.toThrow('immutable');
    const row=await f.service.repository.transaction(s=>s.lessons.find(l=>l.id===f.first.id)!);
    const template=JSON.parse(Buffer.from(f.objects.get(row.templateKey)!).toString());template.sources[0].citation='Modified unreviewed source';f.objects.set(row.templateKey,Buffer.from(JSON.stringify(template)));
    await expect(f.preparation.current(f.student.id,f.first.id)).rejects.toThrow('reviewed teaching materials');
  });
});
