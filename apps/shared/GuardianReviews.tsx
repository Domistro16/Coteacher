import { useEffect, useState } from 'react';
import { accountApi as api } from './account-api';
import type { LearnerService } from '../../delivery/learner-service';
type Review = Awaited<ReturnType<LearnerService['reviews']>>[number];
export function GuardianReviews() {
  const [rows,setRows]=useState<Review[]>([]), [message,setMessage]=useState('');
  const load=()=>api('guardian/reviews').then(setRows).catch(e=>setMessage(e.message));
  useEffect(()=>{void load();},[]);
  return <section className="content-card"><h2>Guardian relationship reviews</h2><p>Simulated requests only. Verify the relationship independently; mailbox control alone is insufficient. Questionnaire answers are private.</p><button onClick={()=>void load()}>Refresh guardian reviews</button>
    {message && <p role="status">{message}</p>}{rows.map(r=><article key={r.id}><h3>Learner {r.studentId}</h3><p>{r.guardianEmail} · {r.status} · {r.mailboxVerified?'Mailbox verified':r.tokenVerified?'Simulated token verified; real mailbox unverified':'Token verification pending'} · Authority {r.authorityDeclared?'declared':'pending'}</p>
      {r.status==='verified' && <form onSubmit={e=>{e.preventDefault();const d=new FormData(e.currentTarget);void api('guardian/reviews',{id:r.id,studentId:r.studentId,approved:d.get('decision')==='approve',reason:d.get('reason')}).then(()=>load()).catch(e=>setMessage(e.message));}}>
        <label>Relationship decision<select name="decision"><option value="reject">Reject</option><option value="approve">Approve verified relationship</option></select></label>
        <label>Independent review reason<input name="reason" required maxLength={300}/></label><button>Save guardian review</button>
      </form>}
    </article>)}</section>;
}
