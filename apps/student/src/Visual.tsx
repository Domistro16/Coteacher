import type { LessonPackage } from '@coteacher/shared';
import { useId } from 'react';
import { explainerMotion, lessonMotionLoopMs } from './lesson-motion';
import { WrittenLabel } from './ExplainerLayer';
import { useReducedVisualMotion, useVisualTime } from './useVisualTime';
import { VisualWatermark } from './VisualWatermark';

export function Sources({ lesson, refs }: { lesson: LessonPackage; refs: readonly string[] }) {
  return <div className="sources" role="group" aria-label="Sources"><p className="eyebrow">From your teacher’s sources</p><ul>{refs.map(id => {
    const source = lesson.sources.find(s => s.id === id)!;
    return <li key={id}><strong>{source.title}</strong><span>{source.citation}</span></li>;
  })}</ul></div>;
}
export function Visual({ conceptId, elapsedMs, sourceRefs }: { conceptId: string; elapsedMs?: number; sourceRefs?: readonly string[] }) {
  const refraction = conceptId === 'refraction';
  const arrow = useId();
  const reduced = useReducedVisualMotion();
  const { surface, time } = useVisualTime(conceptId, elapsedMs, !reduced);
  const motion = explainerMotion(reduced ? 0 : time, reduced);
  const scene = motion.progress(.02, .18);
  const ray = motion.progress(.22, .60);
  const direction = motion.progress(.60, .70);
  const rayPath = refraction ? 'M130 183L210 110L353 37' : 'M45 115H365';
  return <figure ref={surface} className="lesson-visual" data-source-refs={sourceRefs?.join(' ')}><svg key={conceptId} className="lesson-motion-enter"
    data-motion-loop-ms={lessonMotionLoopMs} data-motion-phase={motion.phase.toFixed(5)} data-motion-time-ms={Math.round(time)} data-reduced-motion={reduced}
    viewBox="0 0 420 234" role="img" aria-label={refraction ? 'Light changes direction crossing from water into air at an angle' : 'A light ray follows a straight path in a uniform medium'}>
    <defs><marker id={arrow} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="none" stroke="#b36516" strokeWidth="1.5" /></marker></defs>
    <rect x="0" y="0" width="420" height="210" rx="18" fill="#f6f4e9" />
    <g opacity={motion.opacity}>
      {refraction ? <><g opacity={scene} data-build="medium" data-build-progress={scene.toFixed(4)} transform={`translate(0 ${40 * (1 - scene)})`}><path d="M0 110H420V192Q420 210 402 210H18Q0 210 0 192Z" fill="#d9eeeb"/><path d="M0 110H420" stroke="#649b91" strokeWidth="2"/></g>
        <path d="M210 24V194" stroke="#8ca69b" strokeDasharray="5 6" opacity={motion.progress(.12, .22)}/>
        <WrittenLabel x={22} y={45} text="Air" fill="#242039" progress={motion.progress(.08, .22)}/><WrittenLabel x={22} y={156} text="Water" fill="#242039" progress={motion.progress(.12, .25)}/>
        <WrittenLabel x={238} y={188} text="Water–air boundary" fill="#242039" fontSize={13} progress={motion.progress(.68, .82)}/></>
        : <><circle cx="45" cy="115" r={10 * scene} fill="#dfb466" opacity={scene} data-build="source" data-build-progress={scene.toFixed(4)}/>
          <WrittenLabel x={25} y={47} text="One uniform medium" fill="#242039" progress={motion.progress(.03, .20)}/>
          <WrittenLabel x={140} y={166} text="Direction of light" fill="#242039" fontSize={14} progress={motion.progress(.65, .80)}/></>}
      <path d={rayPath} fill="none" stroke="#b36516" strokeWidth="4" strokeLinecap="round" pathLength="100" strokeDasharray="100 100" strokeDashoffset={(1 - ray) * 100} opacity={Math.min(1, ray * 8)} data-build="ray" data-build-progress={ray.toFixed(4)}/>
      <path d={rayPath} fill="none" stroke="none" markerEnd={`url(#${arrow})`} opacity={direction} data-build="arrow" data-build-progress={direction.toFixed(4)}/>
    </g>
    <VisualWatermark width={420} height={234}/>
  </svg><figcaption>{refraction ? 'Follow the ray: straight in each medium, a change of direction at the boundary.' : 'The medium stays the same, so the ray’s path stays straight.'}</figcaption></figure>;
}
