import Ajv from 'ajv/dist/2020.js';
import schema from '../../../schemas/prepared-support.schema.json' with {type:'json'};
import type { PreparedSupport } from './generated/prepared-support';
import type { LessonPackage,Question } from './generated/lesson-package';
import { checkedKnowledge } from './learning-engine';
export type { PreparedSupport };
export const validPreparedSupport=new Ajv({strict:true}).compile<PreparedSupport>(schema);
export const preparedBudgetBytes=180000;
export function checkPreparedSupport(value:unknown,lesson:LessonPackage):asserts value is PreparedSupport {
  if(!validPreparedSupport(value) || new TextEncoder().encode(JSON.stringify(value)).length>preparedBudgetBytes)throw new Error('Prepared support exceeds its contract or size budget.');
  checkedKnowledge(value.knowledge,lesson);
  if([...value.candidates,...value.explanations].some(c=>!lesson.concepts.some(x=>x.id===c.conceptId)))throw new Error('Prepared content has an unknown concept.');
  if(value.schoolId!==value.knowledge.schoolId || value.lessonId!==lesson.lessonId || value.lessonRevision!==value.knowledge.lessonRevision || value.sourceRevision!==value.knowledge.sourceRevision || value.language!==value.knowledge.language || value.configuration!==value.knowledge.configuration)throw new Error('Prepared support revision mismatch.');
  const generatedValid=(c:PreparedSupport['candidates'][number]|PreparedSupport['explanations'][number])=>c.origin==='generated' && c.id.startsWith('prepared-') && c.quotes?.length &&
    c.quotes.every(q=>lesson.concepts.some(concept=>concept.variants.some(v=>v.id===q.variantId && v.type!=='tryit' && v.sourceRefs.includes(q.sourceRef) && v.content.includes(q.quote)))) &&
    c.sourceRefs.every(id=>c.quotes!.some(q=>q.sourceRef===id));
  if(new Set(value.candidates.map(c=>c.id)).size!==value.candidates.length || new Set(value.explanations.map(c=>c.id)).size!==value.explanations.length ||
    value.candidates.some(c=>!generatedValid(c) && !lesson.questionBank.some(q=>q.id===c.id && q.conceptId===c.conceptId && q.question===c.question && q.answer===c.answer && JSON.stringify(q.sourceRefs)===JSON.stringify(c.sourceRefs))) ||
    value.explanations.some(c=>!generatedValid(c) && !lesson.concepts.find(x=>x.id===c.conceptId)?.variants.some(v=>v.id===c.id && v.type!=='tryit' && v.content===c.text && JSON.stringify(v.sourceRefs)===JSON.stringify(c.sourceRefs))))throw new Error('Reusable candidates must match reviewed instruction or carry checked source excerpts.');
  if(value.status==='approved' && !value.reviewedAt)throw new Error('Teacher review is required.');
}
export function preparedQuestions(lesson:LessonPackage):Question[]{
  if(!lesson.preparedSupport)return lesson.questionBank;
  checkPreparedSupport(lesson.preparedSupport,lesson);
  if(lesson.preparedSupport.status!=='approved')throw new Error('Prepared support is not teacher-approved.');
  return [...lesson.questionBank,...lesson.preparedSupport.candidates.filter(c=>!lesson.questionBank.some(q=>q.id===c.id)).map(c=>({id:c.id,question:c.question,alternatePhrasings:[],answer:c.answer,conceptId:c.conceptId,timelineStepId:lesson.timeline.find(t=>t.conceptId===c.conceptId)!.id,sourceRefs:c.sourceRefs as Question['sourceRefs'],audience:'class' as const}))];
}
/** Rank approved candidates; this does not invent content or promise a predicted question. */
export function rankPreparedQuestions(support:PreparedSupport,knowledgeKeys:readonly string[]) {
  return [...support.candidates].sort((a,b)=>{
    const score=(c:typeof a)=>c.rank+(knowledgeKeys.includes(support.knowledge.concepts.find(x=>x.conceptId===c.conceptId)?.knowledgeKey??'')?20:0);
    return score(b)-score(a)||a.id.localeCompare(b.id);
  });
}
