import { LocalPrivateStorage } from '../../delivery/private-storage';
import { SchoolLessons } from '../../delivery/school-lessons';
import { LearnerService } from '../../delivery/learner-service';
import { PreparationService } from '../../delivery/preparation-service';
import type { SchoolService } from '../../delivery/school-store';
import { schoolFixture,schoolRecording } from '../school-fixture';
import { MockTutor } from '../tutor-fixture';
/** Explicit fictional fixtures, synthetic recordings and mocked generation. No learner interaction evidence is seeded. */
export async function seedLearning(school:SchoolService,folder:string){
  const f=await schoolFixture(school);
  await school.command(f.outsider.id,'request-join',{schoolId:f.school.id});
  const member=(await school.snapshot(f.owner.id)).memberships.find(m=>m.accountId===f.outsider.id)!;
  await school.command(f.owner.id,'membership',{schoolId:f.school.id,id:member.id,status:'active'});
  await school.command(f.owner.id,'placement',{schoolId:f.school.id,studentId:f.outsider.id,groupId:f.group.id});
  const storage=new LocalPrivateStorage(folder+'/private'),lessons=new SchoolLessons(school,storage),preparation=new PreparationService(school,lessons,storage,new MockTutor()),learners=new LearnerService(school,'simulated-local-school-tutor-key-v1');
  for(const [account,format] of [[f.student,'picture'],[f.outsider,'steps']] as const){
    await learners.update(account.id,{revision:0,ageBand:'adult',permissions:{essential:true,personalization:true,externalAI:false},answers:{preferredName:account.name,classLevel:'JSS2',subjects:['Science'],language:'English',readingEase:'ok',formats:[format],length:'short',medium:'both',confusion:'teacher',input:'type',largerText:account.id===f.student.id,reducedMotion:account.id===f.student.id,slowerAudio:account.id===f.student.id},complete:true});
  }
  for(const revisit of [false,true]){
    const row=await lessons.publish(f.teacher.id,f.offerings[0].id,schoolRecording(revisit).lesson,false,true);
    const draft=await preparation.generate(f.teacher.id,row.id);
    await preparation.approve(f.teacher.id,row.id,{reviewed:true,concepts:draft.knowledge.concepts.map(c=>({...c,knowledgeKey:'reviewed-science:'+c.conceptId}))});
  }
}
