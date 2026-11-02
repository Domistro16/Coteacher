import { describe,it,expect } from 'vitest';
import { emptyProgress,personalizedReplay } from '@coteacher/shared';
import { schoolRecording } from './school-fixture';
import { checkedKnowledge,emptyPrivateMemory,updateLearnerEvidence,selectApprovedSupport,completeLearnerLesson,mergePrivateMemory,optionalPrompt,studentModelInput,recordSupportSelection,pruneEvidence,validPrivateMemory,type LessonKnowledge } from '../packages/shared/src/learning-engine';
import { evaluateStudentModel, type StudentModel } from '../packages/shared/src/student-model';
import { encryptPayload,decryptPayload } from '@coteacher/shared';
const now='2026-11-01T10:00:00Z';
function fixture(revision='lesson-one'){
  const {lesson:original}=schoolRecording();const lesson=personalizedReplay(original,original.recording!,{difficulty:'insufficient-history'});
  const knowledge:LessonKnowledge={schemaVersion:'1.0.0',schoolId:'fictional-school',subjectKey:'fictional-school:science',lessonId:lesson.lessonId,lessonRevision:revision,sourceRevision:'sources-v1',language:'English',configuration:'rules-v1',reviewedAt:now,
    concepts:lesson.concepts.map(c=>({conceptId:c.id,knowledgeKey:'science:'+c.id,prerequisites:[],sourceRefs:['notes-light']}))};
  const memory={...emptyPrivateMemory(lesson.studentId),personalization:true,preferences:{formats:['picture' as const]}};
  const progress=emptyProgress(lesson);return {lesson,knowledge,memory,progress};
}
describe('private individual cross-lesson adaptation',()=>{
  it('does not turn retries or the same assessed content in a later lesson into independent trials',()=>{
    const f=fixture(),q=f.lesson.quiz.find(q=>q.conceptId==='refraction')!;
    for(const [i,correct]of [false,true].entries())f.progress.events.push({type:'quiz-answered',eventId:'attempt-'+i,timestamp:now,conceptId:q.conceptId,quizId:q.id,selectedIndex:correct?q.correctIndex:(q.correctIndex+1)%q.options.length,correctness:correct,sourceRefs:q.sourceRefs});
    let memory=updateLearnerEvidence(f.memory,f.lesson,f.progress,f.knowledge,now);
    const first=evaluateStudentModel(studentModelInput(memory,f.lesson,f.knowledge,q.conceptId,now));
    expect(first.sampleCount).toBe(1);expect(first.correctCount).toBe(0);
    const second=fixture('later-revision');second.progress.events.push({...f.progress.events[1],eventId:'later-attempt'});
    memory=updateLearnerEvidence(memory,second.lesson,second.progress,second.knowledge,now);
    expect(evaluateStudentModel(studentModelInput(memory,second.lesson,second.knowledge,q.conceptId,now)).sampleCount).toBe(1);
    const legacy={...memory,evidence:memory.evidence.map(({assessmentKey:_key,...event})=>event)};
    expect(evaluateStudentModel(studentModelInput(legacy,f.lesson,f.knowledge,q.conceptId,now)).sampleCount).toBe(0);
  });
  it('persists source-linked private decision output with encryption and idempotent selection identity',async()=>{
    const f=fixture();const memory=recordSupportSelection(f.memory,f.lesson,f.knowledge,'refraction',now,'event-selection','refraction-steps','steps');
    const record=memory.decisions![0];expect(record).toMatchObject({selectedVisualId:'refraction-steps',basis:'explicit-choice',sourceRefs:['notes-light'],evidenceIds:['event-selection'],model:{status:'abstain',abstainReason:'cold-start',confidence:0}});
    expect(recordSupportSelection(memory,f.lesson,f.knowledge,'refraction',now,'event-selection','refraction-steps','steps').decisions).toHaveLength(1);
    expect(()=>recordSupportSelection(memory,f.lesson,f.knowledge,'refraction',now,'event-selection','refraction-pencil')).toThrow('cannot be rewritten');
    const encrypted=await encryptPayload(memory,'111111');expect(JSON.stringify(encrypted)).not.toContain(record.reason);
    const restored=await decryptPayload(encrypted,'111111');expect(validPrivateMemory(restored)).toBe(true);expect(restored).toEqual(memory);
    expect(validPrivateMemory({...memory,decisions:[{...record,learnerId:'another'}]})).toBe(false);
  });
  it('bounds private decisions, drops expired/completed history and prevents withdrawal resurrection',()=>{
    const f=fixture();const memory=recordSupportSelection(f.memory,f.lesson,f.knowledge,'refraction',now,'selection','refraction-pencil');
    const record=memory.decisions![0];
    const crowded={...memory,decisions:Array.from({length:1001},(_,i)=>({...record,id:'decision-'+i,selectionId:'selection-'+i,at:new Date(Date.parse(now)-1001+i).toISOString()}))};
    expect(pruneEvidence(crowded,now).decisions).toHaveLength(1000);
    expect(pruneEvidence(memory,'2027-03-01T00:00:00Z').decisions).toEqual([]);
    const completed={...memory,completedLessons:Array.from({length:6},(_,i)=>({lessonId:i===0?record.lessonId:'other-'+i,completedAt:new Date(Date.parse(now)-6000+i*1000).toISOString()}))};
    expect(pruneEvidence(completed,now).decisions).toEqual([]);
    expect(mergePrivateMemory(memory,{...emptyPrivateMemory(memory.learnerId),consentRevision:8},now).decisions).toEqual([]);
    const renewed={...emptyPrivateMemory(memory.learnerId),personalization:true,consentRevision:9,clearedBefore:now};
    expect(mergePrivateMemory(memory,renewed,now).decisions).toEqual([]);
    expect(recordSupportSelection({...f.memory,personalization:false},f.lesson,f.knowledge,'refraction',now,'off','refraction-pencil').decisions).toEqual([]);
  });
  it('keeps adapter defaults on low confidence/model failure and explicit choices override an eligible prediction',()=>{
    const f=fixture();const evidence=Array.from({length:10},(_,i)=>({id:'event-'+i,assessmentKey:'unique-item-'+i,lessonId:'lesson-one',subjectKey:f.knowledge.subjectKey,knowledgeKey:'science:refraction',at:now,kind:'assessment' as const,correct:i===9,sourceRefs:['notes-light']}));
    const limited={...f.memory,evidence:evidence.slice(1)};
    expect(selectApprovedSupport(limited,f.lesson,f.knowledge,'refraction',now).visualAssetId).toBe('refraction-pencil');
    const enough={...f.memory,evidence};expect(selectApprovedSupport(enough,f.lesson,f.knowledge,'refraction',now).visualAssetId).toBe('refraction-steps');
    expect(selectApprovedSupport(enough,f.lesson,f.knowledge,'refraction',now,'picture').basis).toBe('explicit-choice');
    const broken:StudentModel={version:'failed-model',evaluate(){throw new Error('unavailable');}};
    expect(selectApprovedSupport(enough,f.lesson,f.knowledge,'refraction',now,undefined,broken).visualAssetId).toBe('refraction-pencil');
  });
  it('changes support after an assessment, deduplicates evidence and carries it only through approved mappings',()=>{
    const f=fixture();const quiz=f.lesson.quiz.find(q=>q.conceptId==='refraction')!;
    expect(selectApprovedSupport(f.memory,f.lesson,f.knowledge,'refraction',now).visualAssetId).toBe('refraction-pencil');
    f.progress.events.push({type:'quiz-answered',eventId:'fictional-wrong',timestamp:now,conceptId:quiz.conceptId,quizId:quiz.id,selectedIndex:(quiz.correctIndex+1)%quiz.options.length,correctness:false,sourceRefs:quiz.sourceRefs});
    let m=updateLearnerEvidence(f.memory,f.lesson,f.progress,f.knowledge,now);
    m=updateLearnerEvidence(m,f.lesson,f.progress,f.knowledge,now);expect(m.evidence).toHaveLength(1);
    m=completeLearnerLesson(m,f.knowledge,now);
    const second=fixture('lesson-two');const decision=selectApprovedSupport(m,second.lesson,second.knowledge,'refraction',now);
    expect(decision.visualAssetId).toBe('refraction-steps');expect(decision.basis).toBe('observed');expect(decision.evidenceIds).toHaveLength(1);
    expect(selectApprovedSupport(m,second.lesson,{...second.knowledge,subjectKey:'fictional-school:art'},'refraction',now).basis).toBe('signup');
    const unmapped={...second.knowledge,concepts:second.knowledge.concepts.map(c=>({...c,knowledgeKey:'another:'+c.conceptId}))};
    expect(selectApprovedSupport(m,second.lesson,unmapped,'refraction',now).basis).toBe('signup');
    expect(selectApprovedSupport(m,second.lesson,second.knowledge,'light-path',now).basis).toBe('signup');
    expect(selectApprovedSupport(m,second.lesson,second.knowledge,'refraction',now,'picture').basis).toBe('explicit-choice');
  });
  it('keeps learners independent, treats pauses as context, and rejects mismatched owners or unreviewed concepts',()=>{
    const f=fixture();f.progress.events.push({type:'pause',eventId:'pause',timestamp:now,conceptId:'refraction',timelineStepId:'step-refraction'});
    const m=updateLearnerEvidence(f.memory,f.lesson,f.progress,f.knowledge,now);expect(m.evidence).toHaveLength(0);
    expect(()=>selectApprovedSupport({...m,learnerId:'another'},f.lesson,f.knowledge,'refraction',now)).toThrow('another learner');
    expect(()=>checkedKnowledge({...f.knowledge,concepts:[]},f.lesson)).toThrow('reviewed lesson');
    const other={...emptyPrivateMemory(f.lesson.studentId),personalization:true,preferences:{formats:['steps' as const]}};
    expect(selectApprovedSupport(other,f.lesson,f.knowledge,'refraction',now).visualAssetId).toBe('refraction-steps');
    expect(selectApprovedSupport(m,f.lesson,f.knowledge,'refraction',now).visualAssetId).toBe('refraction-pencil');
    const help=emptyProgress(f.lesson);help.events.push({type:'explain-again',eventId:'first-help',timestamp:now,conceptId:'refraction',timelineStepId:'step-refraction'});
    const first=updateLearnerEvidence(f.memory,f.lesson,help,f.knowledge,now);
    const secondKnowledge={...f.knowledge,lessonRevision:'another-incomplete',subjectKey:'fictional-school:another-subject'};
    const secondHelp=emptyProgress(f.lesson);secondHelp.events.push({type:'explain-again',eventId:'second-help',timestamp:now,conceptId:'refraction',timelineStepId:'step-refraction'});
    const two=updateLearnerEvidence(first,f.lesson,secondHelp,secondKnowledge,now);expect(two.evidence).toHaveLength(2);expect(new Set(two.evidence.map(e=>e.subjectKey)).size).toBe(2);
  });
  it('expires evidence after 90 days and the last five completed lessons and prompts once per early lesson',()=>{
    const f=fixture();let m:import('../packages/shared/src/learning-engine').PrivateLearnerMemory={...f.memory,preferences:{formats:['steps']}};
    for(let i=0;i<7;i++){
      const k={...f.knowledge,lessonRevision:'revision-'+i};const q=f.lesson.quiz[0];const at=new Date(Date.parse(now)-10000+i*1000).toISOString();
      const p=emptyProgress(f.lesson);p.events.push({type:'quiz-answered',eventId:'check-'+i,timestamp:at,conceptId:q.conceptId,quizId:q.id,selectedIndex:q.correctIndex,correctness:true,sourceRefs:q.sourceRefs});
      m=completeLearnerLesson(updateLearnerEvidence(m,f.lesson,p,k,now),k,at);
      if(i===0){const id=optionalPrompt(m,k)!;expect(id).toBeTruthy();m={...m,promptedLessons:[id]};expect(optionalPrompt(m,k)).toBeUndefined();}
    }
    expect(m.completedLessons).toHaveLength(5);expect(m.evidence).toHaveLength(5);
    const recommendation=selectApprovedSupport(m,f.lesson,f.knowledge,'light-path',now);expect(recommendation.basis).toBe('observed');expect(recommendation.visualAssetId).toBe('light-path-steps');
    const later='2027-03-01T00:00:00Z';expect(mergePrivateMemory(null,m,later).evidence).toHaveLength(0);
  });
  it('withdrawal wins over cached optional memory and never infers mastery from a successful activity',()=>{
    const f=fixture();f.progress.events.push({type:'tryit-completed',eventId:'self-report',timestamp:now,conceptId:'refraction',timelineStepId:'step-refraction',variantId:'refraction-tryit'});
    const m=updateLearnerEvidence(f.memory,f.lesson,f.progress,f.knowledge,now);expect(m.evidence).toHaveLength(0);
    expect(mergePrivateMemory(m,{...emptyPrivateMemory(f.lesson.studentId),consentRevision:5},now).personalization).toBe(false);
    const basic=updateLearnerEvidence({...m,personalization:false},f.lesson,f.progress,f.knowledge,now);expect(basic.evidence).toEqual([]);
    const previous={...m,evidence:[{id:'old',lessonId:'old-lesson',subjectKey:f.knowledge.subjectKey,knowledgeKey:'science:refraction',kind:'assessment' as const,correct:false,at:'2026-11-01T09:00:00Z',sourceRefs:['notes-light']}],completedLessons:[{lessonId:'old-lesson',completedAt:'2026-11-01T09:01:00Z'}]};
    const renewed={...emptyPrivateMemory(f.lesson.studentId),personalization:true,consentRevision:7,clearedBefore:'2026-11-01T09:30:00Z'};
    expect(mergePrivateMemory(previous,renewed,now).evidence).toEqual([]);
  });
});
