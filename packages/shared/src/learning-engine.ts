import Ajv from 'ajv/dist/2020.js';
import memorySchema from '../../../schemas/learner-memory.schema.json' with {type:'json'};
import knowledgeSchema from '../../../schemas/lesson-knowledge.schema.json' with {type:'json'};
import decisionSchema from '../../../schemas/adaptation-decision.schema.json' with {type:'json'};
import type { PrivateLearnerMemory } from './generated/learner-memory';
import type { LessonKnowledge } from './generated/lesson-knowledge';
import type { AdaptationDecision } from './generated/adaptation-decision';
import type { LessonPackage } from './generated/lesson-package';
import type { ProgressRecord } from './generated/progress-record';
import type { TutorState } from './generated/tutor-state';
import { validateProgressRecord } from './validation';
import { validTutorState } from './tutor-memory';
import { evaluateStudentModel, bayesianEvidenceBaseline, type StudentModel, type StudentModelInput, type StudentDecision } from './student-model';
export type { PrivateLearnerMemory, LessonKnowledge, AdaptationDecision };
const ajv=new Ajv({strict:true});
const memoryShape=ajv.compile<PrivateLearnerMemory>(memorySchema);
export function validPrivateMemory(value:unknown):value is PrivateLearnerMemory {
  return memoryShape(value) && new Set(value.evidence.map(e=>e.id)).size===value.evidence.length &&
    new Set(value.completedLessons.map(e=>e.lessonId)).size===value.completedLessons.length &&
    value.evidence.every(e=>Number.isFinite(Date.parse(e.at)) && (e.kind!=='assessment'||typeof e.correct==='boolean') && (e.kind!=='choice'||!!e.representation)) &&
    value.completedLessons.every(e=>Number.isFinite(Date.parse(e.completedAt))) &&
    new Set((value.decisions??[]).map(d=>d.id)).size===(value.decisions??[]).length &&
    new Set((value.decisions??[]).map(d=>d.lessonId+':'+d.selectionId)).size===(value.decisions??[]).length &&
    (value.decisions??[]).every(d=>d.learnerId===value.learnerId && Number.isFinite(Date.parse(d.at)));
}
export const validLessonKnowledge=ajv.compile<LessonKnowledge>(knowledgeSchema);
export const validAdaptationDecision=ajv.compile<AdaptationDecision>(decisionSchema);
export const emptyPrivateMemory=(learnerId:string):PrivateLearnerMemory=>({schemaVersion:'1.0.0',learnerId,simulated:true,consentRevision:0,personalization:false,preferences:{},evidence:[],completedLessons:[],promptedLessons:[],decisions:[]});
export function mergePrivateMemory(local:PrivateLearnerMemory|null,server:PrivateLearnerMemory,now:string):PrivateLearnerMemory {
  if(!validPrivateMemory(server) || (local && (!validPrivateMemory(local)||local.learnerId!==server.learnerId)))throw new Error('Cannot merge another learner’s memory.');
  if(!server.personalization || !local)return pruneEvidence(server,now);
  const evidence=new Map(server.evidence.map(e=>[e.id,e]));for(const e of local.evidence){const previous=evidence.get(e.id);if(previous && JSON.stringify(previous)!==JSON.stringify(e))throw new Error('Conflicting learning evidence.');evidence.set(e.id,e);}
  const completed=new Map(server.completedLessons.map(e=>[e.lessonId,e]));for(const e of local.completedLessons)if(!completed.has(e.lessonId))completed.set(e.lessonId,e);
  const decisions=new Map((server.decisions??[]).map(d=>[d.id,d]));
  for(const d of local.decisions??[]){const previous=decisions.get(d.id);if(previous && JSON.stringify(previous)!==JSON.stringify(d))throw new Error('Conflicting private decisions.');decisions.set(d.id,d);}
  return pruneEvidence({...server,evidence:[...evidence.values()],decisions:[...decisions.values()],completedLessons:[...completed.values()],promptedLessons:[...new Set([...server.promptedLessons,...(local.clearedBefore===server.clearedBefore?local.promptedLessons:[])])].slice(0,3)},now);
}
export function checkedKnowledge(knowledge:unknown,lesson:LessonPackage):asserts knowledge is LessonKnowledge {
  if(!validLessonKnowledge(knowledge) || knowledge.lessonId!==lesson.lessonId ||
    knowledge.concepts.length!==lesson.concepts.length || new Set(knowledge.concepts.map(c=>c.conceptId)).size!==knowledge.concepts.length || new Set(knowledge.concepts.map(c=>c.knowledgeKey)).size!==knowledge.concepts.length || knowledge.concepts.some(c=>c.prerequisites.includes(c.knowledgeKey)) ||
    knowledge.concepts.some(c=>!lesson.concepts.some(x=>x.id===c.conceptId) || c.sourceRefs.some(id=>!lesson.sources.some(s=>s.id===id)))) throw new Error('Concept mapping does not belong to this reviewed lesson.');
}
function checkedOwner(memory:PrivateLearnerMemory,lesson:LessonPackage) {
  if(!validPrivateMemory(memory) || memory.learnerId!==lesson.studentId)throw new Error('Private memory belongs to another learner.');
}
export function pruneEvidence(memory:PrivateLearnerMemory,now:string):PrivateLearnerMemory {
  if(!Number.isFinite(Date.parse(now)))throw new Error('Invalid learning-memory time.');
  if(!memory.personalization)return {...memory,evidence:[],decisions:[],completedLessons:[],promptedLessons:[]};
  const cutoff=Math.max(Date.parse(now)-90*86400000,memory.clearedBefore?Date.parse(memory.clearedBefore)+1:0);
  const completed=memory.completedLessons.filter(x=>Date.parse(x.completedAt)>=cutoff && Date.parse(x.completedAt)<=Date.parse(now)).sort((a,b)=>Date.parse(a.completedAt)-Date.parse(b.completedAt)).slice(-5);
  const relevant=new Set(completed.map(x=>x.lessonId));
  const incomplete=memory.evidence.filter(e=>!memory.completedLessons.some(l=>l.lessonId===e.lessonId));
  const active=new Set(incomplete.map(e=>e.lessonId));
  const decisions=(memory.decisions??[]).filter(d=>Date.parse(d.at)>=cutoff && Date.parse(d.at)<=Date.parse(now) &&
    (relevant.has(d.lessonId)||!memory.completedLessons.some(l=>l.lessonId===d.lessonId))).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)||a.id.localeCompare(b.id)).slice(-1000);
  return {...memory,completedLessons:completed,decisions,evidence:memory.evidence.filter(e=>Date.parse(e.at)>=cutoff && Date.parse(e.at)<=Date.parse(now) && (relevant.has(e.lessonId)||active.has(e.lessonId))).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)||a.id.localeCompare(b.id)).slice(-1000)};
}
/** Conservative identity for the same assessed content across lessons/retries.
 * The bounded fingerprint is not an authentication hash. A collision only
 * under-counts evidence; raw prompts/options are not retained in model input. */
function assessmentItemKey(item:{prompt:string;options:readonly string[];correctIndex:number}) {
  const normalize=(s:string)=>s.trim().toLowerCase().replace(/\s+/g,' ');
  const content=JSON.stringify([normalize(item.prompt),item.options.map(normalize),item.correctIndex]);
  let hash=14695981039346656037n;
  for(const char of content)hash=BigInt.asUintN(64,(hash^BigInt(char.codePointAt(0)!))*1099511628211n);
  return 'assessed-content-v1:'+hash.toString(16).padStart(16,'0');
}
export function updateLearnerEvidence(memory:PrivateLearnerMemory,lesson:LessonPackage,progress:ProgressRecord,knowledge:LessonKnowledge,now:string,tutor?:TutorState):PrivateLearnerMemory {
  checkedOwner(memory,lesson);checkedKnowledge(knowledge,lesson);
  if(!validateProgressRecord(progress,lesson).valid)throw new Error('Only validated lesson events can update learner evidence.');
  if(tutor && !validTutorState(tutor,lesson,progress))throw new Error('Only validated check attempts can update learner evidence.');
  if(!memory.personalization)return {...memory,evidence:[],decisions:[],completedLessons:[],promptedLessons:[]};
  const next=structuredClone(memory), ids=new Set(next.evidence.map(e=>e.id));
  const lessonKey=knowledge.lessonId+'@'+knowledge.lessonRevision;
  const append=(entry:PrivateLearnerMemory['evidence'][number])=>{if(!ids.has(entry.id)){next.evidence.push(entry);ids.add(entry.id);}};
  progress.events.forEach((e,index)=>{
    const map=knowledge.concepts.find(c=>c.conceptId===e.conceptId);if(!map)return;
    const base={id:lessonKey+':'+(e.eventId??'legacy-'+index),lessonId:lessonKey,subjectKey:knowledge.subjectKey,knowledgeKey:map.knowledgeKey,at:e.timestamp,sourceRefs:[...map.sourceRefs]};
    if(e.type==='quiz-answered' && e.selectedIndex!==undefined && e.sourceRefs?.length) append({...base,kind:'assessment',correct:e.correctness,
      ...(!progress.events.slice(0,index).some(previous=>previous.type==='quiz-answered' && previous.quizId===e.quizId)?{assessmentKey:assessmentItemKey(lesson.quiz.find(q=>q.id===e.quizId)!)}:{})});
    if(e.type==='explain-again')append({...base,kind:'help'});
    if(e.type==='visual-explored' && e.origin==='learner-choice')append({...base,kind:'choice',representation:e.visualAssetId.includes('steps')?'steps':'picture'});
  });
  for(const a of tutor?.checkAttempts??[]){
    const check=tutor?.checks?.find(c=>c.id===a.checkId);const map=knowledge.concepts.find(c=>c.conceptId===check?.conceptId);
    if(check && map)append({id:lessonKey+':check:'+a.id,lessonId:lessonKey,subjectKey:knowledge.subjectKey,knowledgeKey:map.knowledgeKey,at:a.answeredAt,kind:'assessment',correct:a.correctness,sourceRefs:[...check.sourceRefs],
      ...(tutor!.checkAttempts!.find(first=>first.checkId===a.checkId)?.id===a.id?{assessmentKey:assessmentItemKey(check)}:{})});
  }
  return pruneEvidence(next,now);
}
export function completeLearnerLesson(memory:PrivateLearnerMemory,knowledge:LessonKnowledge,now:string):PrivateLearnerMemory {
  const lessonId=knowledge.lessonId+'@'+knowledge.lessonRevision;
  if(!memory.personalization || memory.completedLessons.some(x=>x.lessonId===lessonId))return memory;
  return pruneEvidence({...memory,completedLessons:[...memory.completedLessons,{lessonId,completedAt:now}]},now);
}
/** Current explicit choice wins. Assessment is evidence; pauses and self-confirmation are not mastery. */
export function studentModelInput(memory:PrivateLearnerMemory,lesson:LessonPackage,knowledge:LessonKnowledge,conceptId:string,now:string):StudentModelInput {
  checkedOwner(memory,lesson);checkedKnowledge(knowledge,lesson);
  const map=knowledge.concepts.find(c=>c.conceptId===conceptId);if(!map)throw new Error('Unknown mapped concept.');
  const recent=pruneEvidence(memory,now);
  return {schemaVersion:'1.0.0',learnerId:memory.learnerId,schoolId:knowledge.schoolId,subjectKey:knowledge.subjectKey,knowledgeKey:map.knowledgeKey,
    conceptId,lessonId:lesson.lessonId,lessonRevision:knowledge.lessonRevision,asOf:now,personalization:memory.personalization,simulated:true,
    assessments:recent.evidence.filter(e=>e.kind==='assessment' && e.assessmentKey && e.subjectKey===knowledge.subjectKey && e.knowledgeKey===map.knowledgeKey)
      .map(e=>({evidenceId:e.id,assessmentKey:e.assessmentKey!,subjectKey:e.subjectKey,knowledgeKey:e.knowledgeKey,at:e.at,correct:e.correct!}))};
}
function supportSelection(memory:PrivateLearnerMemory,lesson:LessonPackage,knowledge:LessonKnowledge,conceptId:string,now:string,explicit?:'picture'|'steps',studentModel:StudentModel=bayesianEvidenceBaseline) {
  checkedOwner(memory,lesson);checkedKnowledge(knowledge,lesson);
  const map=knowledge.concepts.find(c=>c.conceptId===conceptId);if(!map)throw new Error('Unknown mapped concept.');
  const recent=pruneEvidence(memory,now);
  const evidence=memory.personalization?recent.evidence.filter(e=>e.subjectKey===knowledge.subjectKey && e.knowledgeKey===map.knowledgeKey):[];
  let representation:'picture'|'steps'='picture',basis:AdaptationDecision['basis']='default';
  let reason='Use the teacher-approved default while evidence is limited.';
  const assessed=evidence.filter(e=>e.kind==='assessment');
  const estimate=evaluateStudentModel(studentModelInput(memory,lesson,knowledge,conceptId,now),studentModel);
  const meaningfulLessons=new Set(recent.evidence.filter(e=>e.subjectKey===knowledge.subjectKey && ['assessment','help'].includes(e.kind) && recent.completedLessons.some(l=>l.lessonId===e.lessonId)).map(e=>e.lessonId));
  if(memory.personalization && memory.preferences.formats?.length){representation=memory.preferences.formats.includes('steps')?'steps':'picture';basis='signup';reason='You asked for '+(representation==='steps'?'step-by-step support.':'pictures to help explain ideas.');}
  const reportedConfidence=memory.preferences.confidence?.find(c=>c.subject===lesson.subject)?.rating;
  if(memory.personalization && !assessed.length && (memory.preferences.readingEase==='hard' || reportedConfidence!==undefined && reportedConfidence<=2)){
    representation='steps';basis='signup';reason='Try the approved steps with extra scaffolding. This uses your editable reading or subject-confidence preference, not an assessment of understanding.';
  }
  if(memory.personalization && assessed.at(-1)?.correct===false){representation='steps';basis='observed';reason='Your recent check on this mapped concept needs another look. Try the approved steps.';}
  else if(meaningfulLessons.size>=3 && evidence.length){
    const choice=evidence.filter(e=>e.kind==='choice').at(-1);
    representation=choice?.representation??representation;basis='observed';reason=choice?'Recent relevant lesson interactions guide this suggestion; you can switch it.':'Recent relevant lesson interactions guide support; your saved explanation preference breaks the tie between approved representations.';
  }
  if(memory.personalization && estimate.status==='estimate' && estimate.nextCheckProbability<0.5 && assessed.at(-1)?.correct!==false){
    representation='steps';basis='observed';reason='Recent check responses suggest trying the approved steps. You can switch.';
  }
  if(explicit){representation=explicit;basis='explicit-choice';reason='Use the representation you chose for this moment.';}
  const assets=lesson.visualAssets?.filter(a=>a.conceptId===conceptId)??[];
  const selected=assets.find(a=>representation==='steps'?a.id.includes('steps'):!a.id.includes('steps'))??assets[0];
  if(!selected)throw new Error('No approved support exists for this concept.');
  const decision:AdaptationDecision={schemaVersion:'1.0.0',learnerId:memory.learnerId,lessonId:lesson.lessonId,conceptId,visualAssetId:selected.id,basis,reason,evidenceIds:basis==='observed'?evidence.slice(-100).map(e=>e.id):[],sourceRefs:[...selected.sourceRefs]};
  if(!validAdaptationDecision(decision))throw new Error('Invalid adaptation decision.');return {decision,estimate};
}
/** Compatibility adapter: callers still receive the original approved-support contract. */
export function selectApprovedSupport(memory:PrivateLearnerMemory,lesson:LessonPackage,knowledge:LessonKnowledge,conceptId:string,now:string,explicit?:'picture'|'steps',model:StudentModel=bayesianEvidenceBaseline):AdaptationDecision {
  return supportSelection(memory,lesson,knowledge,conceptId,now,explicit,model).decision;
}
/** Called for an actual selected support event, never for a render or media timer. */
export function recordSupportSelection(memory:PrivateLearnerMemory,lesson:LessonPackage,knowledge:LessonKnowledge,conceptId:string,at:string,selectionId:string,selectedVisualId:string,explicit?:'picture'|'steps',model:StudentModel=bayesianEvidenceBaseline):PrivateLearnerMemory {
  checkedOwner(memory,lesson);checkedKnowledge(knowledge,lesson);
  if(!memory.personalization)return pruneEvidence(memory,at);
  const lessonId=knowledge.lessonId+'@'+knowledge.lessonRevision;
  const previous=(memory.decisions??[]).find(d=>d.lessonId===lessonId && d.selectionId===selectionId);
  if(previous){if(previous.selectedVisualId!==selectedVisualId || previous.at!==at)throw new Error('An existing private selection cannot be rewritten.');return memory;}
  const asset=lesson.visualAssets?.find(a=>a.id===selectedVisualId && a.conceptId===conceptId);
  if(!asset)throw new Error('Only selected approved support may be recorded.');
  const {decision:selected,estimate}=supportSelection(memory,lesson,knowledge,conceptId,at,explicit,model);
  const record:StudentDecision={schemaVersion:'1.0.0',id:'decision-'+selectionId,selectionId,learnerId:memory.learnerId,lessonId,subjectKey:knowledge.subjectKey,
    knowledgeKey:knowledge.concepts.find(c=>c.conceptId===conceptId)!.knowledgeKey,conceptId,selectedVisualId,basis:selected.basis,
    reason:selected.visualAssetId===selectedVisualId?selected.reason:'Use this existing teacher-approved alternative selected in the current interaction.',
    at,simulated:true,model:estimate,evidenceIds:[...new Set([...selected.evidenceIds,selectionId])],sourceRefs:[...asset.sourceRefs]};
  const next=pruneEvidence({...memory,decisions:[...(memory.decisions??[]),record]},at);
  if(!validPrivateMemory(next))throw new Error('Invalid private support decision.');return next;
}
/** Reorders existing sourced variants only. The objective, recording and concepts are unchanged. */
export function preferredHelpLesson(lesson:LessonPackage,memory?:PrivateLearnerMemory):LessonPackage {
  if(!memory?.personalization)return lesson;
  return {...lesson,route:{...lesson.route,conceptRoutes:lesson.route.conceptRoutes.map(route=>{
    const concept=lesson.concepts.find(c=>c.id===route.conceptId)!;
    const desired=memory.preferences.length==='short' || memory.preferences.readingEase==='hard'?'short':memory.preferences.formats?.includes('steps')?'stepwise':undefined;
    if(!desired)return route;
    return {...route,variantOrder:[...route.variantOrder].sort((a,b)=>Number(concept.variants.find(v=>v.id===b)?.type===desired)-Number(concept.variants.find(v=>v.id===a)?.type===desired)) as typeof route.variantOrder};
  }) as typeof lesson.route.conceptRoutes}};
}
export function optionalPrompt(memory:PrivateLearnerMemory,knowledge:LessonKnowledge) {
  const id=knowledge.lessonId+'@'+knowledge.lessonRevision;
  return memory.personalization && memory.completedLessons.length<=3 && memory.completedLessons.some(x=>x.lessonId===id) && !memory.promptedLessons.includes(id) && memory.promptedLessons.length<3 ? id : undefined;
}
