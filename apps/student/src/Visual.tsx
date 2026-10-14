import type { LessonPackage } from '@coteacher/shared';

export function Sources({ lesson, refs }: { lesson: LessonPackage; refs: readonly string[] }) {
  return <div className="sources" role="group" aria-label="Sources"><p className="eyebrow">From your teacher’s sources</p><ul>{refs.map(id => {
    const source = lesson.sources.find(s => s.id === id)!;
    return <li key={id}><strong>{source.title}</strong><span>{source.citation}</span></li>;
  })}</ul></div>;
}
export function Visual({ conceptId }: { conceptId: string }) {
  const refraction = conceptId === 'refraction';
  return <figure className="lesson-visual"><svg viewBox="0 0 420 210" role="img" aria-label={refraction ? 'Light changes direction crossing from water into air at an angle' : 'A light ray follows a straight path in a uniform medium'}>
    <defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="none" stroke="#b36516" strokeWidth="1.5" /></marker></defs>
    <rect x="0" y="0" width="420" height="210" rx="18" fill="#f6f4e9" />
    {refraction ? <><path d="M0 110H420V192Q420 210 402 210H18Q0 210 0 192Z" fill="#d9eeeb" /><path d="M0 110H420" stroke="#649b91" strokeWidth="2" /><path d="M210 24V194" stroke="#8ca69b" strokeDasharray="5 6" /><path d="M130 183L210 110L353 37" stroke="#b36516" strokeWidth="4" fill="none" markerEnd="url(#arrow)" /><text x="22" y="45">Air</text><text x="22" y="156">Water</text><text x="238" y="188" fontSize="13">Water–air boundary</text></>
      : <><text x="25" y="47">One uniform medium</text><path d="M45 115H365" stroke="#b36516" strokeWidth="4" markerEnd="url(#arrow)" /><circle cx="45" cy="115" r="10" fill="#dfb466" /><text x="140" y="166" fontSize="14">Direction of light</text></>}
  </svg><figcaption>{refraction ? 'Follow the ray: straight in each medium, a change of direction at the boundary.' : 'The medium stays the same, so the ray’s path stays straight.'}</figcaption></figure>;
}
