import { useEffect, useRef, useState } from 'react';
import { movePresentation, presentStep, startPresentation, type LessonPackage } from '@coteacher/shared';
import { Sources } from '../../student/src/Visual';
import { TeachingCanvas } from './TeachingCanvas';
import { useProjector } from './useProjector';
import type { PresentationMotion, ProjectorFrame } from './projector-channel';
import { useVisualTime } from '../../student/src/useVisualTime';

export function Presentation({ lesson, busy, projector, onProjector, onUpdate, onPrepare, motion }: {
  lesson: LessonPackage | null; busy: boolean; projector: boolean;
  onProjector: () => void; onUpdate: (transform: (lesson: LessonPackage) => LessonPackage) => void; onPrepare: () => void;
  motion: PresentationMotion | null;
}) {
  const [details, setDetails] = useState(false);
  const panel = useRef<HTMLDialogElement>(null);
  const classroom = lesson?.classroomTimeline;
  const index = lesson && classroom ? lesson.timeline.findIndex(step => step.id === classroom.currentStepId) : -1;
  const current = lesson?.timeline[index];
  const concept = lesson?.concepts.find(entry => entry.id === current?.conceptId);
  const captureTime = motion ? motion.stepId === current?.id ? motion.elapsedMs : 0 : undefined;
  const ambient = useVisualTime<HTMLDivElement>(current?.id ?? '', captureTime, Boolean(current));
  const frame: ProjectorFrame | null = lesson && classroom && current && concept ? {
    lessonId: lesson.lessonId, sessionId: classroom.sessionId, stepId: current.id, conceptId: concept.id,
    title: lesson.title, conceptTitle: concept.title, teacherSaid: current.teacherSaid,
    sourceRefs: current.sourceRefs,
    visualNumber: index + 1, visualCount: lesson.timeline.length,
    motion: { stepId: current.id, elapsedMs: ambient.time, running: motion?.running ?? true },
  } : null;
  const display = useProjector(frame);
  useEffect(() => {
    if (details) panel.current?.showModal(); else panel.current?.close();
  }, [details]);
  useEffect(() => {
    if (!classroom || !lesson) return;
    const key = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (busy || details || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey
        || target?.closest('input,textarea,select,button,[contenteditable="true"],[role="dialog"]')) return;
      if (event.key === 'ArrowRight' && index < lesson.timeline.length - 1) { event.preventDefault(); onUpdate(value => movePresentation(value, 1)); }
      if (event.key === 'ArrowLeft' && index > 0) { event.preventDefault(); onUpdate(value => movePresentation(value, -1)); }
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [classroom, lesson, index, busy, details, onUpdate]);
  if (!lesson) return <section className="cue content-card"><h2>Approve this lesson before presenting.</h2>
    <p>Review the sources and instructional content in Prepare lesson, then approve it for your classroom.</p>
    <button className="primary" disabled>Start presentation</button> <button onClick={onPrepare}>Review lesson</button>
  </section>;
  if (!classroom || !frame || !current) return <section className="cue content-card studio-ready"><p className="eyebrow">Ready for your classroom</p>
    <h2>{lesson.title}</h2><p>{lesson.objective.text}</p>
    <p>Your approved visuals are ready. Open the studio to check microphone access, connect a projector and teach.</p>
    <button className="primary" disabled={busy} onClick={() => onUpdate(value => startPresentation(value))}>Start presentation</button>
  </section>;
  return <section className="cue studio-presentation" data-presentation-step-id={current.id} data-presentation-concept-id={frame.conceptId}>
    <header className="studio-heading"><div><p className="eyebrow">CLASSROOM STUDIO · {lesson.subject}</p>
      <p className="presentation-lesson-title">{lesson.title}</p></div><span className="studio-count">Visual {index + 1} / {lesson.timeline.length}</span></header>
    <div ref={ambient.surface} className="studio-canvas-space"><TeachingCanvas frame={frame}/></div>
    <div className="studio-display-tools"><button onClick={display.open}>Open projector display</button>
      <button onClick={onProjector}>{projector ? 'Exit focused studio' : 'Focus studio'}</button>
      <button onClick={() => setDetails(true)}>Lesson notes & sources</button><span role="status">{display.status}</span></div>
    {display.error && <div role="alert" className="safety projector-error"><p>{display.error}</p><button onClick={display.dismissError}>Dismiss projector message</button></div>}
    <nav className="timeline-navigation" aria-label="Presentation controls">
      <button disabled={busy || index === 0} onClick={() => onUpdate(value => movePresentation(value, -1))}>Previous visual</button>
      <span>{frame.conceptTitle}</span>
      <button className="primary" disabled={busy || index === lesson.timeline.length - 1} onClick={() => onUpdate(value => movePresentation(value, 1))}>Next visual</button>
    </nav>
    <nav className="concept-navigation" aria-label="Presentation concepts">{lesson.timeline.map((step, position) =>
      <button key={step.id} disabled={busy} aria-current={current.id === step.id ? 'step' : undefined}
        onClick={() => onUpdate(value => presentStep(value, step.id))}>{position + 1}. {lesson.concepts.find(entry => entry.id === step.conceptId)!.title}</button>)}</nav>
    <dialog ref={panel} className="studio-notes" aria-label="Lesson notes and sources" onCancel={() => setDetails(false)} onClose={() => setDetails(false)}>
      <button className="primary" onClick={() => setDetails(false)}>Return to studio</button><h2>{frame.conceptTitle}</h2>
      <p>{current.teacherSaid}</p><Sources lesson={lesson} refs={current.sourceRefs}/>
      <details className="classroom-history"><summary>Classroom timeline · {classroom.visits.length} {classroom.visits.length === 1 ? 'visit' : 'visits'}</summary>
        <ol>{classroom.visits.map((visit, position) => <li key={position} data-timeline-step-id={visit.timelineStepId} data-concept-id={visit.conceptId}>
          {lesson.concepts.find(entry => entry.id === visit.conceptId)!.title}<span className="small"> · {new Date(visit.presentedAt).toLocaleTimeString()}</span>
        </li>)}</ol><p className="small">Display visits are saved. Recorded packages use the audio’s sample-timed visual cues.</p>
      </details>
      <p className="small">Arrow keys advance visuals when you are not editing or using a control. In the projector window, press F or double-click the visual for fullscreen. Escape exits fullscreen.</p>
    </dialog>
  </section>;
}
