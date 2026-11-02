import { useState } from 'react';
import { accountApi as api } from '../../shared/account-api';
import type { PreparedSupport } from '../../../packages/shared/src/preparation';
export function PreparedSupportReview({publicationId}:{publicationId:string}){
  const [support,setSupport]=useState<PreparedSupport|null>(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[reviewed,setReviewed]=useState(false);
  const run=async(work:()=>Promise<PreparedSupport|null>)=>{setBusy(true);setMessage('');try{setSupport(await work());}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}};
  return <section className="content-card"><h3>Prepare reusable lesson support</h3><p>Prepare once for this lesson revision. Learners receive reviewed alternatives; the objective and classroom recording stay the same.</p>
    <p>Approved support is immutable. Publish a new lesson revision to replace approved questions or mappings.</p><button disabled={busy} onClick={()=>void run(()=>api(`lessons/${publicationId}/preparation`))}>Load prepared support</button>
    <button disabled={busy} onClick={()=>{setReviewed(false);void run(()=>api(`lessons/${publicationId}/preparation`,{action:'draft'}));}}>Prepare reviewed question candidates</button>
    <button disabled={busy} onClick={()=>{setReviewed(false);void run(()=>api(`lessons/${publicationId}/preparation`,{action:'generate'}));}}>Generate source-checked support with configured model</button>
    {message && <p role="status">{message}</p>}{support && <><p>Support: {support.status} · {support.candidates.length} candidate questions · {support.explanations.length} explanations · {new TextEncoder().encode(JSON.stringify(support)).length} bytes</p>
      <p>These are reusable reviewed candidates, not guaranteed predictions. They do not use private conversations. Source identifiers require your factual and safety review.</p>
      <details><summary>Questions and explanations</summary>{support.candidates.map(q=><article key={q.id}><h4>{q.question}</h4><p>{q.answer}</p><small>Sources: {q.sourceRefs.join(', ')} · rank {q.rank}</small>{q.quotes?.map((quote,i)=><blockquote key={i}><p>{quote.quote}</p><cite>Reviewed explanation {quote.variantId} · source {quote.sourceRef}</cite></blockquote>)}</article>)}{support.explanations.map(e=><article key={e.id}><p>{e.text}</p><small>Sources: {e.sourceRefs.join(', ')}</small>{e.quotes?.map((quote,i)=><blockquote key={i}><p>{quote.quote}</p><cite>Reviewed explanation {quote.variantId} · source {quote.sourceRef}</cite></blockquote>)}</article>)}</details>
      <fieldset><legend>Reviewed concept mappings</legend><p>Use the same knowledge key across lessons only when evidence applies to the same concept in this subject. Prerequisites guide refreshers; they never establish mastery of a different concept.</p>
        {support.knowledge.concepts.map((c,i)=><div key={c.conceptId}><strong>{c.conceptId}</strong><label>Knowledge key for {c.conceptId}<input disabled={support.status==='approved'} maxLength={100} value={c.knowledgeKey} onChange={e=>setSupport(s=>s?{...s,knowledge:{...s.knowledge,concepts:s.knowledge.concepts.map((x,j)=>j===i?{...x,knowledgeKey:e.target.value}:x)}}:s)}/></label><label>Prerequisite keys for {c.conceptId}<input disabled={support.status==='approved'} value={c.prerequisites.join(',')} onChange={e=>setSupport(s=>s?{...s,knowledge:{...s.knowledge,concepts:s.knowledge.concepts.map((x,j)=>j===i?{...x,prerequisites:e.target.value.split(',').map(x=>x.trim()).filter(Boolean)}:x)}}:s)}/></label></div>)}
      </fieldset>
      <label><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/>I reviewed source support, misconceptions, concept mappings and activity safety.</label>
      <button disabled={busy || !reviewed || support.status==='approved'} onClick={()=>void run(()=>api(`lessons/${publicationId}/preparation`,{action:'approve',reviewed,concepts:support.knowledge.concepts}))}>Approve reusable support</button>
    </>}
  </section>;
}
