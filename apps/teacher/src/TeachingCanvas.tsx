import { Visual } from '../../student/src/Visual';
import type { ProjectorFrame } from './projector-channel';

/** The approved classroom visual and words, shared by studio and projector. */
export function TeachingCanvas({ frame }: { frame: ProjectorFrame }) {
  return <article className="teaching-canvas" data-visual-id={frame.stepId} data-concept-id={frame.conceptId} data-source-refs={frame.sourceRefs.join(' ')}>
    <h2>{frame.conceptTitle}</h2>
    <Visual conceptId={frame.conceptId} elapsedMs={frame.motion.elapsedMs} sourceRefs={frame.sourceRefs}/>
    <p className="explanation">{frame.teacherSaid}</p>
  </article>;
}
