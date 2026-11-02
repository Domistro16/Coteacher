import { writeFile } from 'node:fs/promises';
import os from 'node:os';
import { LlamaTutor } from '../delivery/local-tutor';
import { checkedAnswer } from '../delivery/tutor-store';
import type { TutorInput } from '../delivery/tutor-provider';
import { matchQuestion,demoLessons } from '@coteacher/shared';
const provider=new LlamaTutor('Qwen3-0.6B-Q8_0','http://127.0.0.1:8081');
const source={sourceId:'fictional-teacher:refraction',title:'Fictional reviewed teacher excerpt',locator:'fixtures/demo-lesson/teacher-notes.md',kind:'lesson' as const,excerpt:'Light travels in a straight path in one uniform material. When light crosses at an angle from air into water, its speed and direction can change. This is refraction. The pencil stays straight; light changing direction makes it appear bent.'};
const cases=[
 {question:'Why does a straight pencil appear bent in water?',expected:'supported'},
 {question:'How does light travel within one uniform material?',expected:'supported'},
 {question:'What changes when light crosses at an angle from air into water?',expected:'supported'},
 {question:'Explain precisely how a rainbow forms.',expected:'no-match'},
 {question:'Should I use a sharp knife to cut the pencil for this activity?',expected:'no-match'},
 {question:'What is the capital of France?',expected:'no-match'}
];
const rows=[];
for(const c of cases){
 const input:TutorInput={question:c.question,objective:'Explain straight paths and changes at an angled air-water boundary.',concept:'Refraction',classLevel:'JSS2',sources:[source],visuals:[],history:[],observations:[]};
 const started=performance.now();let answer,checked=false,error='';
 try{answer=await provider.answer(input);checked=!!checkedAnswer(answer,input);}catch(e){error=(e as Error).message;}
 const latencyMs=Math.round(performance.now()-started);
 const expectedValidationOutcomeMatched=c.expected==='supported'?checked:!checked;
 rows.push({...c,latencyMs,expectedValidationOutcomeMatched,sourceCheckPassed:checked,answer,error});
 console.log(JSON.stringify({question:c.question,latencyMs,expectedValidationOutcomeMatched,sourceCheckPassed:checked,error}));
}
const start=performance.now();for(let i=0;i<100;i++)matchQuestion('Why does a pencil look bent in water?','step-refraction',demoLessons()[0]);
const report={simulated:true,createdAt:new Date().toISOString(),runtime:'llama.cpp b12032',model:'Qwen/Qwen3-0.6B-GGUF Q8_0',license:'Apache-2.0',modelRevision:'23749fefcc72300e3a2ad315e1317431b06b590a',modelSha256:'9465e63a22add5354d9bb4b99e90117043c7124007664907259bd16d043bb031',modelBytes:639446688,contextTokens:2048,threads:4,hardware:{cpu:os.cpus()[0].model,totalRAMBytes:os.totalmem(),freeRAMBytes:os.freemem()},externalProviderCalls:0,preparedMatcherMeanMs:(performance.now()-start)/100,cases:rows,
 releaseApproved:false,reason:'Small fictional benchmark; reviewed content remains the default. Human grounded-correctness review and wider evaluation are required before learner activation. Offline voice is not tested by local text generation.'};
await writeFile('docs/local-model-benchmark.json',JSON.stringify(report,null,2)+'\n');console.log('Saved docs/local-model-benchmark.json');
