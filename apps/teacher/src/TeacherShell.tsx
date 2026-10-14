import { useEffect, useState, type ReactNode } from 'react';
import type { LessonPackage, LessonRecording, ProgressRecord } from '@coteacher/shared';
import { Brand, Icon, LearningArt, clock, type IconName } from '../../student/src/student-ui';
import { Visual } from '../../student/src/Visual';
import { readRecording } from './recording-storage';

export type Screen = 'dashboard' | 'lessons' | 'prepare' | 'teach' | 'review' | 'publish' | 'insights' | 'questions' | 'transfers' | 'settings';
const navigation: { id: Screen; title: string; icon: IconName }[] = [
  { id: 'dashboard', title: 'Dashboard', icon: 'home' },
  { id: 'lessons', title: 'My Lessons', icon: 'lessons' },
  { id: 'prepare', title: 'Prepare lesson', icon: 'spark' },
  { id: 'teach', title: 'Teach / projector', icon: 'play' },
  { id: 'review', title: 'Recording review', icon: 'check' },
  { id: 'publish', title: 'Publish packages', icon: 'arrow' },
  { id: 'insights', title: 'Class insights', icon: 'progress' },
  { id: 'questions', title: 'Questions', icon: 'help' },
  { id: 'transfers', title: 'Sync & Transfers', icon: 'download' },
  { id: 'settings', title: 'Settings', icon: 'profile' },
];

export function TeacherShell({ screen, navigate, locked, projector, lesson, prepared, approved, recordingPending, recordingRevision, published, records, online, children, onRecording }: {
  screen: Screen; navigate: (screen: Screen) => void; locked: boolean; projector: boolean;
  lesson: LessonPackage | null; prepared: boolean; approved: boolean; recordingPending: boolean; recordingRevision: number;
  published: boolean; records: ProgressRecord[]; online: boolean; children: ReactNode;
  onRecording: (recording: LessonRecording | null) => void;
}) {
  const [recording, setRecording] = useState<LessonRecording | null>(null);
  const [storageError, setStorageError] = useState('');
  useEffect(() => {
    let active = true;
    setRecording(null); onRecording(null); setStorageError('');
    if (lesson?.publication.status === 'approved' && lesson.classroomTimeline) void readRecording(lesson)
      .then(value => { if (active) { setRecording(value); onRecording(value); } })
      .catch(error => { if (active) setStorageError((error as Error).message); });
    return () => { active = false; };
  }, [lesson?.publication.status === 'approved' ? lesson.publication.approvedAt : '', lesson?.classroomTimeline?.sessionId, recordingRevision, recordingPending]);
  const state = published ? 'Published' : recording ? recording.review.status === 'approved' && recording.visualReview?.status === 'approved' ? 'Reviewed recording' : 'Recorded · needs review' : approved ? 'Ready to record' : prepared ? 'Needs review' : 'Draft';
  const pending = records.reduce((sum, record) => sum + record.queuedQuestions.filter(question => !question.answered).length, 0);
  const lessonCard = lesson ? <article className="teacher-lesson-card">
    <div className="teacher-thumbnail"><Visual conceptId="refraction"/><span className="thumbnail-subject">{lesson.subject}</span>{recording && <span className="thumbnail-duration">{clock(recording.durationMs)}</span>}</div>
    <div className="teacher-card-body"><span className={`teacher-status ${published || approved ? 'ready' : ''}`}>{state}</span><h3>{lesson.title}</h3><p>{lesson.classLevel} · {lesson.concepts.length} concepts</p><div className="teacher-card-actions"><button className="primary" onClick={() => navigate(recording ? 'review' : approved ? 'teach' : 'prepare')}><Icon name={recording ? 'play' : 'arrow'} size={18}/>{recording ? 'Review lesson' : approved ? 'Record lesson' : 'Continue preparing'}</button><button aria-label="Open lesson materials" onClick={() => navigate('prepare')}><Icon name="lessons"/></button></div><p className="small">Materials: {approved ? 'approved' : 'draft'} · Audio: {recording ? 'saved' : 'not recorded'}</p></div>
  </article> : <section className="teacher-empty"><span className="empty-icon"><Icon name="lessons" size={32}/></span><h3>Your next great lesson starts here.</h3><p>Bring your teaching materials. We’ll help you organize the replay.</p><button className="primary" onClick={() => navigate('prepare')}>Create New Lesson <Icon name="arrow" size={18}/></button></section>;
  return <div className={`student-app teacher-app ${screen === 'teach' ? 'studio-screen' : ''} ${projector ? 'studio-focus' : ''}`}>
    <a className="skip-link" href="#teacher-content" onClick={event => { event.preventDefault(); document.getElementById('teacher-content')?.focus(); }}>Skip to content</a>
    <aside className="teacher-sidebar"><Brand/><span className="teacher-brand-label">TEACHER WORKSPACE</span><nav aria-label="Teacher workspace">{navigation.map(entry => <button key={entry.id} aria-label={entry.title} disabled={locked} aria-current={screen === entry.id ? 'page' : undefined} onClick={() => navigate(entry.id)}><Icon name={entry.icon} size={20}/><span>{entry.title}</span>{entry.id === 'questions' && pending > 0 && <b>{pending}</b>}</button>)}</nav><div className="teacher-sidebar-note"><Icon name="spark"/><strong>Teach once. Reach further.</strong><p>One lesson. More chances to understand.</p></div></aside>
    <div className="teacher-body"><header className="teacher-topbar"><span className="teacher-mobile-brand"><Brand/></span><span className="teacher-location">Workspace <span>/</span> {navigation.find(entry => entry.id === screen)?.title}</span><div><span className="teacher-connection">{online ? 'Device connected' : 'Working offline'}</span><span className="workspace-avatar" title="Local teacher workspace; accounts are not configured">T</span></div></header>
      <main id="teacher-content" tabIndex={-1} className="teacher-content">
        {storageError && <p className="safety" role="alert">{storageError}</p>}
        {screen === 'dashboard' && <>
          <div className="teacher-page-heading"><div><p className="eyebrow">MAKE ROOM FOR AHA! MOMENTS</p><h1>Welcome back, teacher. <span>👋</span></h1><p>Ready to make today’s lesson memorable?</p></div><span className="workspace-tag">Local demo workspace</span></div>
          <section className="teacher-welcome"><div><span className="hero-pill"><Icon name="spark" size={16}/>Your classroom, carried forward</span><h2>Great teaching.<br/>Another chance to learn.</h2><p>Turn the lesson you teach into a replay<br/>every learner can make their own.</p><button onClick={() => navigate('prepare')}>Create a lesson <Icon name="arrow" size={18}/></button></div><LearningArt/></section>
          <section className="teacher-quick-actions" aria-label="Quick actions">{([
            ['prepare','spark','Create New Lesson','Start with your teaching materials'],
            ['prepare','lessons','Continue Preparing',lesson ? 'Pick up your saved preparation' : 'Select the reviewed demo lesson'],
            ['teach','play','Record a Lesson',approved ? 'Your approved visuals are ready' : 'Review and approve materials first'],
            ['insights','progress','View Student Progress','Find the moments that need another look'],
          ] as const).map(([destination,icon,title,description]) => <button key={title} onClick={() => navigate(destination)}><span className={`quick-icon ${icon}`}><Icon name={icon}/></span><strong>{title}</strong><span>{description}</span><Icon name="arrow" size={16}/></button>)}</section>
          <div className="teacher-dashboard-grid"><section><div className="teacher-section-heading"><h2>My Lessons</h2><button onClick={() => navigate('lessons')}>View library <Icon name="arrow" size={16}/></button></div>{lessonCard}</section><aside className="teacher-dashboard-aside"><section className="content-card"><span className="insight-icon"><Icon name="progress"/></span><h2>A clearer picture of your class</h2><p>{records.length ? `${records.length} learner snapshots received. Open insights to inspect concept-level interactions.` : 'Explore the labelled, simulated class view. Received demo interactions have their own view.'}</p><button onClick={() => navigate('insights')}>Open student insights <Icon name="arrow" size={16}/></button><span className="small">18 seeded learners · simulated</span></section><section className="content-card"><div className="teacher-section-heading"><h2>Student questions</h2><span className="question-count">{pending}</span></div><p>{pending ? 'A little guidance could make a big difference.' : 'No pending questions received yet.'}</p><button onClick={() => navigate('questions')}>Open questions <Icon name="arrow" size={16}/></button></section></aside></div>
        </>}
        {screen === 'lessons' && <><div className="teacher-page-heading"><div><p className="eyebrow">YOUR TEACHING LIBRARY</p><h1>My Lessons</h1><p>From first draft to classroom replay.</p></div><button className="primary" onClick={() => navigate('prepare')}>Create New Lesson <Icon name="spark" size={18}/></button></div><div className="teacher-library">{lessonCard}</div></>}
        {screen === 'review' && <div className="teacher-page-heading"><div><p className="eyebrow">RECORDING & PERSONALIZATION</p><h1>See what your learners will see.</h1><p>One teacher recording. More than one way to understand.</p></div></div>}
        {screen === 'insights' && <div className="teacher-page-heading"><div><p className="eyebrow">CLASSROOM INTELLIGENCE</p><h1>A clearer picture of understanding.</h1><p>Explore observed interactions, then return to the exact teaching moment.</p></div><span className="workspace-tag">Demo insights · sources separated</span></div>}
        {screen === 'transfers' && <div className="teacher-page-heading"><div><p className="eyebrow">KEEP YOUR CLASSROOM CONNECTED</p><h1>Sync & Transfers</h1><p>Bring learning back to school, even when connections are scarce.</p></div></div>}
        {children}
      </main><footer className="teacher-footer"><Brand/><span>Another chance at the lesson.</span></footer>
    </div>
  </div>;
}
