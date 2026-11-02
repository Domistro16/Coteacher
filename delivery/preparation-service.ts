import { createHash } from 'node:crypto';
import { checkPreparedSupport, type PreparedSupport } from '../packages/shared/src/preparation';
import { requirePublishedLesson, type LessonPackage } from '@coteacher/shared';
import { SchoolError, type SchoolService } from './school-store';
import type { SchoolLessons } from './school-lessons';
import type { PrivateStorage } from './private-storage';
import type { TutorProvider, TutorInput } from './tutor-provider';
import { checkedAnswer,tutorSources } from './tutor-store';
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
/** Reuses only reviewed public instruction; no learner conversations enter this cache. */
export class PreparationService {
  constructor(private school:SchoolService,private lessons:SchoolLessons,private storage:PrivateStorage,private provider?:TutorProvider){}
  private async context(actor:string,publicationId:string,teacher=false){
    const row=await this.school.repository.transaction(s=>s.lessons.find(l=>l.id===publicationId && !l.archived));
    if(!row || (teacher ? !(await this.school.canTeach(actor,row.offeringId)) : !(await this.lessons.access(actor,publicationId))))throw new SchoolError(403,'Authorized lesson access required.');
    const lesson=requirePublishedLesson(JSON.parse(Buffer.from(await this.storage.get(row.templateKey)).toString()));
    const subject=await this.school.repository.transaction(s=>s.offerings.find(o=>o.id===row.offeringId)!.subjectId);
    return {row,lesson,subject,sourceRevision:digest(lesson.sources),lessonRevision:digest({concepts:lesson.concepts,questions:lesson.questionBank,quiz:lesson.quiz,objective:lesson.objective,approval:lesson.publication,recordingId:row.recordingId})};
  }
  async draft(actor:string,publicationId:string){
    const {row,lesson,subject,sourceRevision,lessonRevision}=await this.context(actor,publicationId,true);
    if(await this.school.repository.transaction(s=>s.preparedSupport.some(x=>x.publicationId===publicationId && x.data.status==='approved')))throw new SchoolError(409,'Approved support is immutable. Publish a new lesson revision before replacing it.');
    const data:PreparedSupport={schemaVersion:'1.0.0',schoolId:row.schoolId,lessonId:lesson.lessonId,lessonRevision,sourceRevision,language:lesson.language,configuration:'reviewed-rules-v1',status:'draft',
      candidates:lesson.questionBank.map((q,i)=>({id:q.id,conceptId:q.conceptId,question:q.question,answer:q.answer,sourceRefs:[...q.sourceRefs],rank:Math.max(0,70-i),misconception:/bent|broken|straight|change/i.test(q.question)})),
      explanations:lesson.concepts.flatMap(c=>c.variants.flatMap(v=>v.type==='tryit'?[]:[{id:v.id,conceptId:c.id,text:v.content,sourceRefs:[...v.sourceRefs]}])),
      knowledge:{schemaVersion:'1.0.0',schoolId:row.schoolId,subjectKey:row.schoolId+':'+subject,lessonId:lesson.lessonId,lessonRevision,sourceRevision,language:lesson.language,configuration:'reviewed-rules-v1',reviewedAt:lesson.publication.status==='approved'?lesson.publication.approvedAt:new Date().toISOString(),
        concepts:lesson.concepts.map(c=>({conceptId:c.id,knowledgeKey:publicationId+':'+c.id,prerequisites:[],sourceRefs:[...new Set(c.variants.flatMap(v=>v.sourceRefs))]}))}};
    checkPreparedSupport(data,lesson);
    await this.school.repository.transaction(s=>{
      if(!this.school.canTeachInState(s,actor,row.offeringId))throw new SchoolError(403,'Teaching assignment changed.');
      const entry=s.preparedSupport.find(x=>x.publicationId===publicationId);
      if(entry?.data.status==='approved')throw new SchoolError(409,'Approved support changed during preparation.');
      if(entry)entry.data=data;else s.preparedSupport.push({publicationId,data});
    });return data;
  }
  async approve(actor:string,publicationId:string,input:Record<string,unknown>){
    const {row,lesson,lessonRevision,sourceRevision}=await this.context(actor,publicationId,true);
    if(input.reviewed!==true)throw new SchoolError(400,'Review sources, misconceptions, mappings and safe support first.');
    return this.school.repository.transaction(s=>{
      if(!this.school.canTeachInState(s,actor,row.offeringId))throw new SchoolError(403,'Teaching assignment changed.');
      const entry=s.preparedSupport.find(x=>x.publicationId===publicationId);
      if(!entry || entry.data.lessonRevision!==lessonRevision || entry.data.sourceRevision!==sourceRevision)throw new SchoolError(409,'Sources changed. Prepare support again.');
      const data=structuredClone(entry.data);
      if(data.status==='approved'){
        if(input.concepts!==undefined && JSON.stringify(input.concepts)!==JSON.stringify(data.knowledge.concepts))throw new SchoolError(409,'Approved mappings are immutable. Publish a new lesson revision.');
        return data;
      }
      if(input.concepts!==undefined)data.knowledge.concepts=input.concepts as PreparedSupport['knowledge']['concepts'];
      data.status='approved';data.reviewedAt=new Date().toISOString();data.knowledge.reviewedAt=data.reviewedAt;
      checkPreparedSupport(data,lesson);entry.data=data;return data;
    });
  }
  async generate(actor:string,publicationId:string){
    if(!this.provider)throw new SchoolError(503,'No generation model is configured. Reviewed-rule preparation remains available.');
    const {row,lesson,lessonRevision,sourceRevision}=await this.context(actor,publicationId,true);
    const configuration=this.provider.engine+':'+this.provider.model+':preparation-v1';
    const cached=await this.school.repository.transaction(s=>s.preparedSupport.find(x=>x.publicationId===publicationId)?.data);
    if(cached?.configuration===configuration && cached.lessonRevision===lessonRevision && cached.sourceRevision===sourceRevision)return cached;
    if(cached?.status==='approved')throw new SchoolError(409,'Approved support is immutable. Publish a new lesson revision before changing generation settings.');
    // No learner context or private conversations enter reusable generation.
    const data=await this.draft(actor,publicationId);data.configuration=configuration;data.knowledge.configuration=configuration;
    for(const concept of lesson.concepts){
      if(!(await this.school.canTeach(actor,row.offeringId)))throw new SchoolError(403,'Teaching assignment changed during preparation.');
      const question='What should I understand about '+concept.title.toLowerCase()+'?';
      const input:TutorInput={question,objective:lesson.objective.text,concept:concept.title,classLevel:lesson.classLevel,sources:tutorSources(lesson,concept.id,question).filter(x=>x.kind==='lesson'),visuals:[],history:[],observations:[]};
      const answer=await this.provider.answer(input);const checked=checkedAnswer(answer,input);
      if(!checked)throw new SchoolError(422,'Generated support lacks safe source evidence. The reviewed-rule draft is retained.');
      const quotes=checked.citations.map(c=>{
        const variant=lesson.concepts.flatMap(x=>x.variants).find(v=>v.sourceRefs.some(id=>id+':'+v.id===c.sourceId))!;
        return {sourceRef:variant.sourceRefs.find(id=>id+':'+variant.id===c.sourceId)!,variantId:variant.id,quote:c.excerpt};
      });
      const sourceRefs=[...new Set(quotes.map(q=>q.sourceRef))];
      const version=digest({lessonRevision,sourceRevision,configuration,concept:concept.id,text:answer.text}).slice(0,20);
      data.candidates.push({id:'prepared-question-'+version,conceptId:concept.id,question,answer:answer.text,sourceRefs,rank:85,misconception:false,origin:'generated',quotes});
      data.explanations.push({id:'prepared-explanation-'+version,conceptId:concept.id,text:answer.text,sourceRefs,origin:'generated',quotes});
    }
    checkPreparedSupport(data,lesson);
    await this.school.repository.transaction(s=>{
      if(!this.school.canTeachInState(s,actor,row.offeringId))throw new SchoolError(403,'Teaching assignment changed during preparation.');
      if(s.preparedSupport.find(x=>x.publicationId===publicationId)?.data.status==='approved')throw new SchoolError(409,'Support was approved while generation was running.');
      s.preparedSupport.find(x=>x.publicationId===publicationId)!.data=data;
    });return data;
  }
  async current(actor:string,publicationId:string,teacher=false){
    const {lesson,lessonRevision,sourceRevision}=await this.context(actor,publicationId,teacher);
    return this.school.repository.transaction(s=>{
      const entry=s.preparedSupport.find(x=>x.publicationId===publicationId);
      if(!entry || entry.data.lessonRevision!==lessonRevision || entry.data.sourceRevision!==sourceRevision || (!teacher && entry.data.status!=='approved'))return null;
      checkPreparedSupport(entry.data,lesson);return structuredClone(entry.data);
    });
  }
}
