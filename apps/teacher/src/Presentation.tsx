import { movePresentation, presentStep, startPresentation, type LessonPackage } from '@coteacher/shared';
import { Sources, Visual } from '../../student/src/Visual';

export function Presentation({ lesson, busy, projector, onProjector, onUpdate, onPrepare }: {
  lesson: LessonPackage | null; busy: boolean; projector: boolean;
  onProjector: () => void; onUpdate: (transform: (lesson: LessonPackage) => LessonPackage) => void; onPrepare: () => void;
}) {
  if (!lesson) return <section className="cue content-card"><h2>Approve this lesson before presenting.</h2>
    <p>Review the sources and instructional content in Prepare lesson, then approve it for your classroom.</p>
    <button className="primary" disabled>Start presentation</button> <button onClick={onPrepare}>Review lesson</button>
  </section>;
  const classroom = lesson.classroomTimeline;
  if (!classroom) return <section className="cue content-card"><p className="eyebrow">Ready for your classroom</p>
    <h2>{lesson.title}</h2><p>{lesson.objective.text}</p>
    <p>Start the approved lesson, then tap through its concepts. Each displayed moment is saved in the classroom timeline.</p>
    <button className="primary" disabled={busy} onClick={() => onUpdate(current => startPresentation(current))}>Start presentation</button>
  </section>;
  const index = lesson.timeline.findIndex(step => step.id === classroom.currentStepId);
  const current = lesson.timeline[index];
  const concept = lesson.concepts.find(entry => entry.id === current.conceptId)!;
  return <section className="cue content-card" data-presentation-step-id={current.id} data-presentation-concept-id={concept.id}>
    <div className="brand-row"><p className="eyebrow">Teacher's timeline · Step {index + 1} of {lesson.timeline.length}</p>
      <button onClick={onProjector}>{projector ? 'Exit projector view' : 'Expand projector view'}</button></div>
    <h2>{concept.title}</h2><Visual conceptId={concept.id}/><p className="explanation">{current.teacherSaid}</p>
    <Sources lesson={lesson} refs={current.sourceRefs}/>
    <nav className="timeline-navigation" aria-label="Presentation controls">
      <button disabled={busy || index === 0} onClick={() => onUpdate(current => movePresentation(current, -1))}>Previous visual</button>
      <button className="primary" disabled={busy || index === lesson.timeline.length - 1} onClick={() => onUpdate(current => movePresentation(current, 1))}>Next visual</button>
    </nav>
    <nav className="concept-navigation" aria-label="Presentation concepts">{lesson.timeline.map((step, position) =>
      <button key={step.id} disabled={busy} aria-current={current.id === step.id ? 'step' : undefined}
        onClick={() => onUpdate(current => presentStep(current, step.id))}>{position + 1}. {lesson.concepts.find(entry => entry.id === step.conceptId)!.title}</button>)}</nav>
    <details className="classroom-history"><summary>Classroom timeline · {classroom.visits.length} {classroom.visits.length === 1 ? 'visit' : 'visits'}</summary>
      <ol>{classroom.visits.map((visit, position) => <li key={position} data-timeline-step-id={visit.timelineStepId} data-concept-id={visit.conceptId}>
        {lesson.concepts.find(entry => entry.id === visit.conceptId)!.title}
        <span className="small"> · {new Date(visit.presentedAt).toLocaleTimeString()}</span>
      </li>)}</ol>
      <p className="small">Export the personal lesson packages after teaching to include these classroom moments for offline review.</p>
    </details>
    <p className="small">Presentation and timeline saved on this device. Tap to advance.</p>
  </section>;
}
