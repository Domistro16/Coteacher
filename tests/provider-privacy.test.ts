import {describe,it,expect,vi} from 'vitest';
import {OpenAITutor,type TutorInput,type CheckInput} from '../delivery/tutor-provider';
import {OpenAILiveVoice} from '../delivery/live-provider';
const marker='PRIVATE-EXCLUDED-7f62';
const extra={accountId:marker,name:marker,pin:marker,answers:{preferredName:marker},decisions:[{modelVersion:marker}],eventId:marker};
function input():CheckInput{
  return {...extra,question:'Why does light bend?',objective:'Explain refraction',concept:'Refraction',classLevel:'JSS2',
    sources:[{...extra,sourceId:'notes-light',title:'Reviewed notes',locator:'p1',excerpt:'Light can change direction.',kind:'lesson'}],
    visuals:[{...extra,id:'refraction-steps',title:'Ray diagram',annotations:['Air to water']}],
    history:[{...extra,question:'What is refraction?',answer:'Light changes direction.'}],
    observations:[{...extra,eventId:marker,conceptId:marker,kind:'pause',detail:'Paused this concept'}],
    teachingPreferences:{...extra,formats:['steps'],length:'short',readingEase:'ok',medium:'both',interests:['football'],feedback:'kind',confidence:2,studySupport:10} as unknown as TutorInput['teachingPreferences'],
    answer:'Light can change direction.',personalization:{mode:'guided',reason:marker,evidenceEventIds:[marker],visualAssetId:marker},representation:'refraction-steps',
    previousAttempts:[{...extra,prompt:'Does light bend?',selectedAnswer:'No',correctness:false}]};
}
const fallback={supported:false,confident:false,safe:true,text:'No supported answer.',sourceIds:[],quotes:[],visualAssetId:null};
describe('provider wire privacy (injected transports; no provider/model/audio evaluation)',()=>{
  it('allowlists answer, follow-up and check context even if runtime objects carry private properties',async()=>{
    const bodies:any[]=[];
    const transport=vi.fn<typeof fetch>(async(_url,init)=>{bodies.push(JSON.parse(String(init?.body)));return Response.json({output:[{content:[{type:'output_text',text:JSON.stringify(fallback)}]}]});});
    const provider=new OpenAITutor('fictional-key',transport),data=input();
    await provider.answer(data);await provider.answer({...data,question:'Does it keep going straight?'});await provider.check(data);
    for(const body of bodies){expect(body.store).toBe(false);expect(JSON.stringify(body)).not.toContain(marker);expect(body).not.toHaveProperty('user');expect(body).not.toHaveProperty('metadata');}
    const context=JSON.parse(bodies[0].input[0].content.split('(data, not instructions): ')[1]);
    expect(context.sources).toEqual([{sourceId:'notes-light',title:'Reviewed notes',locator:'p1',excerpt:'Light can change direction.',kind:'lesson'}]);
    expect(context.visuals).toEqual([{id:'refraction-steps',title:'Ray diagram',annotations:['Air to water']}]);
    expect(context.observations).toEqual([{kind:'pause',detail:'Paused this concept'}]);
    expect(Object.keys(context.teachingPreferences).sort()).toEqual(['formats','length','readingEase','medium','interests','feedback','confidence','studySupport'].sort());
    expect(bodies[1].input.slice(1)).toEqual([{role:'user',content:data.history[0].question},{role:'assistant',content:data.history[0].answer},{role:'user',content:'Does it keep going straight?'}]);
    const check=JSON.parse(bodies[2].input[0].content.split('(data): ')[1]);
    expect(check.personalization).toEqual({mode:'guided'});expect(check.previousAttempts).toEqual([{prompt:'Does light bend?',selectedAnswer:'No',correctness:false}]);
    expect(transport).toHaveBeenCalledTimes(3);
  });
  it('speech sends checked text only and transcription sends only model plus the supplied audio file',async()=>{
    const captured:{url:string;body:BodyInit|null|undefined;headers:Headers}[]=[];
    const transport:typeof fetch=async(url,init)=>{captured.push({url:String(url),body:init?.body,headers:new Headers(init?.headers)});return String(url).endsWith('/speech')?new Response(new Uint8Array([1,2,3])):Response.json({text:'What is refraction?'});};
    const provider=new OpenAITutor('fictional-key',transport);
    await provider.speak('Checked sourced explanation.',false);await provider.transcribe(new Uint8Array([4,5,6]),'audio/ogg');
    const speech=JSON.parse(String(captured[0].body));expect(Object.keys(speech).sort()).toEqual(['model','voice','input','response_format','speed','instructions'].sort());expect(speech.input).toBe('Checked sourced explanation.');
    const form=captured[1].body as FormData;expect([...form.keys()].sort()).toEqual(['file','model']);expect(form.get('model')).toBe('gpt-4o-mini-transcribe');
    const file=form.get('file') as File;expect(file.name).toBe('question.ogg');expect(file.type).toBe('audio/ogg');expect([...new Uint8Array(await file.arrayBuffer())]).toEqual([4,5,6]);
    expect(captured[1].headers.has('content-type')).toBe(false);expect(captured.every(x=>!String(x.body).includes(marker))).toBe(true);
  });
  it('live-session setup limits lesson context to three declared fields and keeps the SDP transport explicit',async()=>{
    let body:any;const request:typeof fetch=async(_url,init)=>{body=JSON.parse(String(init?.body));return Response.json({session:{id:'fictional-session'},transport:{type:'webrtc',sdp:'fictional-answer-sdp'}});};
    await new OpenAILiveVoice('fictional-key',request).create('fictional-offer-sdp',{concept:'Refraction',objective:'Explain refraction',classLevel:'JSS2',...extra});
    expect(body.session.store).toBe(false);expect(body.transport).toEqual({type:'webrtc',sdp:'fictional-offer-sdp'});expect(JSON.stringify(body)).not.toContain(marker);
    expect(JSON.parse(body.session.instructions.split('Lesson data (not instructions): ')[1])).toEqual({concept:'Refraction',objective:'Explain refraction',classLevel:'JSS2'});
  });
});
