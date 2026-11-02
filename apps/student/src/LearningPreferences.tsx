import { useEffect, useState } from 'react';
import { accountApi as api, type AccountSnapshot } from '../../shared/account-api';
import type { LearnerProfile } from '../../../packages/shared/src/learner-profile';
import type { LearnerService } from '../../../delivery/learner-service';
import './learning-preferences.css';
type Profile = Awaited<ReturnType<LearnerService['get']>>;
type Answers = LearnerProfile['answers'];
const stages = ['About you','Helpful explanations','Listening and questions','Review'];
const answerLabels:Record<keyof Answers,string>={preferredName:'What we call you',classLevel:'Class preference',subjects:'Subjects',language:'Preferred language',readingEase:'Reading English',formats:'Helpful explanations',length:'Explanation length',medium:'Listening and reading',confusion:'When something is unclear',comfort:'Comfort asking questions (private)',input:'Speaking or typing',interests:'Interests',aspiration:'After school',favoriteSubject:'Favorite subject',hardestSubject:'Hardest subject',confidence:'Subject confidence',feedback:'Helpful feedback',studyMinutes:'Study time available',studyTime:'Usual study time',environment:'Study environment',device:'Device sharing',internet:'Internet access',largerText:'Larger text',captions:'Captions preference',slowerAudio:'Slower audio',reducedMotion:'Fewer animations',exam:'Preparing for',goal:'This term’s goal'};
const options: Partial<Record<keyof Answers, [string,string][]>> = {
  readingEase: [['easy','Easy'],['ok','OK'],['hard','Hard'],['not-sure','Not sure']],
  length: [['short','Short'],['detailed','Detailed'],['depends','Depends'],['not-sure','Not sure']],
  medium: [['listening','Listening'],['reading','Reading'],['both','Both'],['not-sure','Not sure']],
  confusion: [['teacher','Ask my teacher'],['friend','Ask a friend'],['quiet','Stay quiet'],['later','Look it up later'],['myself','Try on my own'],['not-sure','Not sure']],
  input: [['speak','Speak'],['type','Type'],['not-sure','Not sure']],
  feedback: [['encouragement','Encouragement'],['direct','Straight to the point'],['hints','Hints first'],['not-sure','Not sure']],
  studyMinutes: [['under-15','Under 15 minutes'],['15-30','15–30 minutes'],['30-60','30–60 minutes'],['over-60','Over an hour'],['not-sure','Not sure']],
  studyTime: [['morning','Morning'],['after-school','After school'],['evening','Evening'],['weekends','Weekends'],['not-sure','Not sure']],
  environment: [['quiet','Quiet'],['noisy','Noisy'],['not-sure','Not sure']],
  device: [['shared','Shared'],['own','My own'],['not-sure','Not sure']],
  internet: [['wifi','Wi-Fi'],['limited','Limited data'],['school-only','None / school only'],['not-sure','Not sure']],
  exam: ['class-tests','WAEC','NECO','JAMB','other','not-sure'].map(x => [x,x === 'not-sure' ? 'Not sure' : x === 'class-tests' ? 'Class tests' : x]),
  goal: [['catch-up','Catch up'],['understand','Understand better'],['grade','Improve a grade'],['not-sure','Not sure']],
};
export function LearningPreferences({state, onClose,onPrivacyClear}: {state: AccountSnapshot; onClose: () => void;onPrivacyClear:()=>Promise<void>}) {
  const [p,setP] = useState<Profile>();
  const [step,setStep] = useState(0);
  const [answers,setAnswers] = useState<Answers>({});
  const [message,setMessage] = useState('');
  const [busy,setBusy] = useState(false);
  const [guardianLink,setGuardianLink] = useState('');
  const [newSubject,setNewSubject]=useState(''),[newInterest,setNewInterest]=useState('');
  const [scopes,setScopes] = useState({essential:false,personalization:false,externalAI:false});
  const activeGroup = state.groups.find(g=>state.placements.some(x=>x.active && x.groupId===g.id));
  function initialAnswers(value:Profile):Answers {
    if(!value.personalizationAllowed)return value.answers;
    const selected=state.enrollments.find(e=>e.status==='approved');
    const subjects=state.offerings.filter(o=>selected?.offeringIds.includes(o.id)).flatMap(o=>state.subjects.filter(s=>s.id===o.subjectId).map(s=>s.name));
    return {preferredName:state.account.name,...(activeGroup?{classLevel:activeGroup.level}:{}),...(subjects.length?{subjects}:{}),language:'English',...value.answers};
  }
  const load = async () => {
    const value:Profile = await api('learner/profile'); setP(value); setAnswers(initialAnswers(value)); setScopes(value.permissions); setStep(value.complete ? 4 : Math.min(value.step,3));
  };
  useEffect(() => { void load().catch(e => setMessage(e.message)); },[state.account.id]);
  const run = async (work: () => Promise<void>) => { setBusy(true); setMessage(''); try { await work(); } catch(e) { setMessage((e as Error).message); } finally { setBusy(false); } };
  const save = async (nextStep:number, complete=false) => {
    const value:Profile = await api('learner/profile',{revision:p!.revision, answers, step:nextStep, ...(complete ? {complete:true} : {})});
    const cachedKeys=['formats','length','readingEase','medium','confidence','input','feedback','largerText','captions','slowerAudio','reducedMotion'];
    if(!value.personalizationAllowed || Object.entries(p!.answers).some(([key,old])=>cachedKeys.includes(key) && JSON.stringify(value.answers[key as keyof Answers])!==JSON.stringify(old)))await onPrivacyClear();
    setP(value); setAnswers(value.answers); setStep(complete ? 4 : nextStep); setMessage('Saved privately.');
  };
  const field = (key:keyof Answers, label:string, required=false, choices=options[key]) => <label key={key}>{label}
    {choices ? <select aria-label={label} value={String(answers[key] ?? '')} required={required} onChange={e=>setAnswers(a=>({...a,[key]:e.target.value || undefined}))}>
      <option value="">{required ? 'Choose an answer' : 'No answer'}</option>{choices.map(([v,t])=><option key={v} value={v}>{t}</option>)}
    </select> : <input aria-label={label} value={String(answers[key] ?? '')} maxLength={key==='aspiration'?120:60} required={required} onChange={e=>setAnswers(a=>({...a,[key]:e.target.value || undefined}))}/>}
  </label>;
  const permissionFields = <>
    <label><input type="checkbox" checked={scopes.essential} onChange={e=>setScopes(s=>({...s,essential:e.target.checked}))}/>Authorize essential account and learning processing</label>
    <label><input type="checkbox" checked={scopes.personalization} onChange={e=>setScopes(s=>({...s,personalization:e.target.checked}))}/>Use my optional answers and learning evidence to personalize support</label>
    <label><input type="checkbox" checked={scopes.externalAI} onChange={e=>setScopes(s=>({...s,externalAI:e.target.checked}))}/>Allow connected AI to receive my questions and relevant teaching preferences</label>
    <p>Connected AI may receive explanation preferences, interests and relevant confidence/study-support signals. Names, age, guardian details and private comfort scores are excluded from structured profile context. Details you include in a question may still be sent. Lesson conversations remain visible to authorized teachers. Basic approved learning remains available if you decline optional processing.</p>
  </>;
  const pickMany=(key:'subjects'|'interests',value:string,checked:boolean)=>setAnswers(a=>({...a,[key]:checked?[...(a[key]??[]),value]:(a[key]??[]).filter(x=>x!==value)}));
  const subjectChoices=[...new Set([...(state.subjects.length?state.subjects.map(s=>s.name):['English','Mathematics','Science','Art','Social Studies','Computer Studies','Not sure']),...(answers.subjects??[])])];
  const interestChoices=[...new Set(['football','music','games','drawing','cooking','fashion','films','coding','reading','languages','business',...(answers.interests??[])])];
  return <section className="content-card learning-preferences" aria-label="My learning preferences">
    <div className="section-heading"><h1>My learning preferences</h1><button onClick={onClose}>Back to learning</button></div>
    <p className="hero-pill">Fictional learner demo · simulated data only</p>
    <p>We ask this to choose examples and explanations that fit you. You can edit or remove answers. Your school controls class placement and subject access.</p>
    {message && <p role="status" className="app-alert">{message}</p>}
    {!p && <p>Loading your private preferences…</p>}
    {p && <>
      <p>Notice {p.noticeVersion} · {p.essentialReady ? 'Authorization ready for this fictional demo' : 'Authorization pending'}</p>
      {p.ageBand === 'unknown' ? <div><h2>About you</h2><p>Are you under 18? We store an age band, never your date of birth.</p>
        <button disabled={busy} onClick={()=>void run(async()=>{setP(await api('learner/profile',{revision:p.revision,ageBand:'under-18'}));})}>Yes, under 18</button>
        <button disabled={busy} onClick={()=>void run(async()=>{setP(await api('learner/profile',{revision:p.revision,ageBand:'adult'}));})}>No, 18 or older</button>
      </div> : <>
        {!p.essentialReady && <div className="authorization-card"><h2>{p.ageBand==='adult'?'Your choices':'Guardian authorization'}</h2>
          {permissionFields}
          {p.ageBand==='adult' ? <button className="primary" disabled={busy || !scopes.essential} onClick={()=>void run(async()=>{const value=await api('learner/profile',{revision:p.revision,permissions:scopes});setP(value);setAnswers(initialAnswers(value));})}>Save authorization choices</button>
          : <>
            <form onSubmit={e=>{e.preventDefault();const email=new FormData(e.currentTarget).get('email');void run(async()=>{
              const value=await api('learner/guardian',{email,scopes});setP(value.profile);setGuardianLink(value.verificationToken?location.origin+'/#guardian='+value.verificationToken:'');setMessage(value.delivery==='email-accepted'?'The email service accepted this verification request. Check the guardian mailbox; delivery is not yet confirmed.':'Simulated link created. No email was sent.');
            });}}><label>Guardian email<input name="email" type="email" autoComplete="off" required maxLength={200}/></label>
              <button disabled={busy || !scopes.essential}>Create fictional guardian review request</button>
            </form>
            <p>When email delivery is not configured, this demo offers a simulated link and does not send a message.</p>
            {guardianLink && <p><a href={guardianLink} target="_blank" rel="noreferrer">Open simulated guardian link</a></p>}
            {p.requests.map(r=><p key={r.id}>Guardian review: {r.expired?'expired':r.status}. {r.schoolId?'Your school reviews the relationship.':'A platform operator reviews the relationship.'}</p>)}
            <button disabled={busy} onClick={()=>void run(load)}>Check authorization status</button>
          </>}
        </div>}
        {p.essentialReady && <>
          <details><summary>Processing choices</summary>{permissionFields}<button disabled={busy} onClick={()=>void run(async()=>{
            const value:Profile=await api('learner/profile',{revision:p.revision,permissions:scopes});if(!value.personalizationAllowed)await onPrivacyClear();setP(value);setAnswers(value.answers);
          })}>Update processing choices</button></details>
          {!p.personalizationAllowed ? <div><p>Optional personalization is off. Approved basic lessons remain available. You can still choose display and audio settings.</p>
            <button disabled={busy} onClick={()=>void run(async()=>{const value=await api('learner/profile',{revision:p.revision,complete:true});setP(value);setStep(4);})}>Continue with basic learning</button></div>
          : <>
            <nav className="preference-steps" aria-label="Onboarding steps">{stages.map((s,i)=><button key={s} aria-current={step===i?'step':undefined} onClick={()=>setStep(i)}>{i+1}. {s}</button>)}</nav>
            <form onSubmit={e=>{e.preventDefault();void run(()=>save(Math.min(step+1,4),step===3 || step===4));}}>
              <h2>{step===4?'Edit your preferences':stages[step]}</h2>
              {(step===0 || step===4) && <>
                {field('preferredName','What should Coteacher call you?',true)}
                {field('classLevel','What class are you in?',true,[...state.levels,'Other','Not sure'].map(x=>[x,x]))}
                {activeGroup && <div><p>School placement: {activeGroup.name}. Changing this preference does not change placement.</p><button type="button" disabled={busy} onClick={()=>void run(async()=>{await api('school/request-learning-placement',{schoolId:activeGroup.schoolId,classLevel:answers.classLevel,subjects:answers.subjects});setMessage('Change request sent to your school. Your approved class and subjects still apply.');})}>Request class and subject changes</button></div>}
                <fieldset><legend>Which subjects are you taking?</legend>{subjectChoices.map((subject,i)=><label key={subject}><input type="checkbox" checked={answers.subjects?.includes(subject)??false} required={!answers.subjects?.length && i===0} disabled={!answers.subjects?.includes(subject) && (answers.subjects?.length??0)>=15} onChange={e=>pickMany('subjects',subject,e.target.checked)}/>{subject}</label>)}
                  <label>Another subject<input value={newSubject} maxLength={60} onChange={e=>setNewSubject(e.target.value)}/></label><button type="button" disabled={!newSubject.trim() || (answers.subjects?.length??0)>=15} onClick={()=>{if(!answers.subjects?.includes(newSubject.trim()))pickMany('subjects',newSubject.trim(),true);setNewSubject('');}}>Add subject preference</button>
                </fieldset>
                {field('language','Which language do you learn best in?',true,['English','Pidgin','Yoruba','Hausa','Igbo','Other','Not sure'].map(x=>[x,x]))}
                <p>Prepared English content is available. Other languages are saved as preferences; translation is not available yet.</p>
                {field('readingEase','How easy is reading English text for you?',true)}
              </>}
              {(step===1 || step===4) && <>
                <fieldset><legend>When something is hard, what helps most? Pick up to two.</legend>{[['picture','Picture / animation'],['try-it','Try it myself'],['steps','Step by step'],['example','Real-life example'],['hearing','Hearing it explained']].map(([v,t])=><label key={v}><input type="checkbox" checked={answers.formats?.includes(v as never)??false} disabled={!answers.formats?.includes(v as never) && (answers.formats?.length??0)>=2} onChange={e=>setAnswers(a=>({...a,formats:(e.target.checked?[...(a.formats??[]),v]:(a.formats??[]).filter(x=>x!==v)) as Answers['formats']}))}/>{t}</label>)}</fieldset>
                {field('length','Short explanations or detailed ones?',true)}{field('medium','Do you prefer listening, reading, or both?',true)}
              </>}
              {(step===2 || step===4) && <>{field('confusion',"When you don’t understand, what do you usually do?",true)}
                {field('input','With Coteacher, would you rather speak or type?',true)}
                <p>Speaking is a preference only. Microphone use always needs a separate choice; offline speech depends on installed browser support.</p>
                <label>Comfort asking questions in class (optional)<select aria-label="Comfort asking questions in class (optional)" value={answers.comfort??''} onChange={e=>setAnswers(a=>({...a,comfort:e.target.value?Number(e.target.value):undefined}))}><option value="">Prefer not to answer</option>{[1,2,3,4,5].map(x=><option key={x} value={x}>{x}</option>)}</select></label>
                <p>This private comfort answer is excluded from teacher and AI-provider views.</p>
              </>}
              {step===3 && <><p>Check your choices before finishing. You can return to any screen.</p><dl>{Object.entries(answers).map(([k,v])=><div key={k}><dt>{answerLabels[k as keyof Answers]}</dt><dd>{Array.isArray(v)?v.map(x=>typeof x==='object'?`${x.subject}: ${x.rating}/5`:x).join(', '):typeof v==='boolean'?v?'On':'Off':options[k as keyof Answers]?.find(([value])=>value===v)?.[1]??String(v)}</dd></div>)}</dl></>}
              {step===4 && <details><summary>Optional interests, study habits and goals</summary>
                <fieldset><legend>Interests (optional, pick up to three)</legend>{interestChoices.map(interest=><label key={interest}><input type="checkbox" checked={answers.interests?.includes(interest)??false} disabled={!answers.interests?.includes(interest) && (answers.interests?.length??0)>=3} onChange={e=>pickMany('interests',interest,e.target.checked)}/>{interest.charAt(0).toUpperCase()+interest.slice(1)}</label>)}
                  <label>Another interest<input value={newInterest} maxLength={40} onChange={e=>setNewInterest(e.target.value)}/></label><button type="button" disabled={!newInterest.trim() || (answers.interests?.length??0)>=3} onClick={()=>{if(!answers.interests?.includes(newInterest.trim()))pickMany('interests',newInterest.trim(),true);setNewInterest('');}}>Add interest</button>
                </fieldset>
                {field('aspiration','What would you like to do after school?')}{field('favoriteSubject','Favorite subject')}{field('hardestSubject','Hardest subject')}
                {(answers.subjects??[]).map(subject=><label key={subject}>Confidence in {subject} (optional)<select value={answers.confidence?.find(x=>x.subject===subject)?.rating??''} onChange={e=>setAnswers(a=>({...a,confidence:[...(a.confidence??[]).filter(x=>x.subject!==subject),...(e.target.value?[{subject,rating:Number(e.target.value)}]:[])] as Answers['confidence']}))}><option value="">No answer</option>{[1,2,3,4,5].map(x=><option key={x}>{x}</option>)}</select></label>)}
                {field('feedback','What feedback helps?')}{field('studyMinutes','How long can you study on a school day?')}{field('studyTime','When do you usually study?')}{field('environment','Study environment')}{field('device','Do you share your device?')}{field('internet','Internet at home')}{field('exam','What are you preparing for?')}{field('goal','What do you want most this term?')}
                <p>Reminders and full exam practice are not available yet. Interests guide relevant examples, never a learner type.</p>
              </details>}
              <button className="primary" disabled={busy}>{step>=3?'Save my preferences':'Save and continue'}</button>
            </form>
          </>}
          <fieldset><legend>Display and audio settings</legend>{[['largerText','Larger text'],['slowerAudio','Slower prepared audio and recording playback'],['reducedMotion','Fewer animations'],['captions','Captions preference']].map(([k,t])=><label key={k}><input type="checkbox" checked={answers[k as keyof Answers]===true} onChange={e=>setAnswers(a=>({...a,[k]:e.target.checked}))}/>{t}</label>)}</fieldset>
          <p>Prepared explanations have text. Teacher-recording captions are not available.</p>
          <button disabled={busy} onClick={()=>void run(()=>save(step))}>Save display and audio settings</button>
        </>}
        <button disabled={busy} onClick={()=>void run(async()=>{const value=await api('learner/withdraw',{});await onPrivacyClear();setP(value);setAnswers({});setGuardianLink('');setScopes({essential:false,personalization:false,externalAI:false});setStep(0);setMessage('Authorization withdrawn and optional answers removed on this device. Other disconnected devices clear optional copies when they next connect.');})}>Withdraw authorization and remove my answers</button>
      </>}
    </>}
  </section>;
}

export function GuardianVerification() {
  const [message,setMessage]=useState(''); const [done,setDone]=useState(false);
  const [details,setDetails]=useState<{scopes:LearnerProfile['permissions'];noticeVersion:string;deliveryMethod?:'email'|'simulated-link'}>();
  useEffect(()=>{
    const inspect=()=>{if(!location.hash.startsWith('#guardian='))return;setDone(false);setDetails(undefined);setMessage('');void api('guardian/details',{token:location.hash.slice('#guardian='.length)}).then(setDetails).catch(e=>setMessage(e.message));};
    inspect();window.addEventListener('hashchange',inspect);return()=>window.removeEventListener('hashchange',inspect);
  },[]);
  return <main className="student-app student-content"><section className="content-card learning-preferences"><h1>Guardian authorization</h1><p>Fictional verification demo. Mailbox verification alone does not establish parental authority. Independent relationship review follows.</p>
    {details && <><p>Notice {details.noticeVersion}. Essential processing: {details.scopes.essential?'requested':'declined'}. Optional personalization: {details.scopes.personalization?'requested':'declined'}. External AI: {details.scopes.externalAI?'requested':'declined'}.</p><p>Personalization uses questionnaire answers and learning evidence. Connected AI receives questions, relevant teaching preferences and permitted confidence/study-support signals; structured profile fields exclude identity, age, guardian details and private comfort scores, but details included in questions may still be sent. You may decline by leaving this request unapproved. Basic approved learning remains available.</p></>}
    <form onSubmit={e=>{e.preventDefault();void api('guardian/verify',{token:location.hash.slice('#guardian='.length),authorityDeclared:true}).then(v=>{setMessage(v.message);setDone(true);history.replaceState(null,'',location.pathname);}).catch(e=>setMessage(e.message));}}>
      <label><input type="checkbox" required disabled={done || !details}/>I am the parent or authorized guardian and have authority to make these choices.</label><button disabled={done || !details}>{details?.deliveryMethod==='email'?'Verify mailbox and declaration':'Verify simulated token and declaration'}</button>
    </form>{message && <p role="status">{message}</p>}</section></main>;
}
