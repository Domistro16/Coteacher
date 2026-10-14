import type { LessonPackage, ProgressEvent, ProgressRecord, QueuedQuestion } from '@coteacher/shared';

/** Derive observations only. No inferred mastery, weighting or merged cohorts. */
export function lessonInsights(lesson: LessonPackage, snapshots: readonly ProgressRecord[]) {
  const latest = new Map<string, ProgressRecord>();
  for (const record of snapshots) {
    if (record.lessonId !== lesson.lessonId) continue;
    const old = latest.get(record.studentId);
    if (!old || Date.parse(record.exportedAt) > Date.parse(old.exportedAt)) latest.set(record.studentId, record);
  }
  const records = [...latest.values()].map(record => {
    const ids = new Set<string>();
    return { ...record, events: record.events.filter(event => {
      if (event.eventId && ids.has(event.eventId)) return false;
      if (event.eventId) ids.add(event.eventId);
      const concept = lesson.concepts.find(entry => entry.id === event.conceptId);
      if (!concept) return false;
      if ('timelineStepId' in event && !lesson.timeline.some(step => step.id === event.timelineStepId && step.conceptId === concept.id)) return false;
      if ('variantId' in event && !concept.variants.some(variant => variant.id === event.variantId)) return false;
      if (event.type === 'quiz-answered' && !lesson.quiz.some(quiz => quiz.id === event.quizId && quiz.conceptId === concept.id)) return false;
      return true;
    }) };
  });
  const concepts = lesson.concepts.map(concept => {
    const steps = lesson.timeline.filter(step => step.conceptId === concept.id);
    const contributors = records.map(record => {
      const events = record.events.filter(event => event.conceptId === concept.id);
      const questions = record.queuedQuestions.filter(question => steps.some(step => step.id === question.timelineStepId)
        && (!question.recordedContext || question.recordedContext.conceptId === concept.id));
      const checks = new Map<string, number>();
      let retries = 0;
      for (const event of events) if (event.type === 'quiz-answered') {
        if (checks.has(event.quizId)) retries++;
        checks.set(event.quizId, (checks.get(event.quizId) ?? 0) + 1);
      }
      return { record, events, questions, explanationRequests: events.filter(event => event.type === 'explain-again').length,
        incorrectChecks: events.filter(event => event.type === 'quiz-answered' && !event.correctness).length,
        retries, pendingQuestions: new Set(questions.filter(question => !question.answered).map(question => question.id)).size,
        unmatchedQuestions: events.filter(event => event.type === 'question-no-match').length,
        pauses: events.filter(event => event.type === 'pause').length };
    });
    const sum = (field: 'explanationRequests' | 'incorrectChecks' | 'retries' | 'pendingQuestions' | 'pauses') => contributors.reduce((n, item) => n + item[field], 0);
    const variants = concept.variants.map(variant => {
      let views = 0, checks = 0, correct = 0;
      const viewers = new Set<string>();
      for (const contributor of contributors) {
        let current: string | undefined;
        // Validated records are append-only; ordering resolves events that share a timestamp.
        for (const event of contributor.events) {
          if (event.type === 'variant-viewed') {
            current = event.variantId;
            if (current === variant.id) { views++; viewers.add(contributor.record.studentId); }
          }
          if (event.type === 'quiz-answered' && current === variant.id) {
            checks++; if (event.correctness) correct++;
          }
        }
      }
      return { variant, views, viewers: viewers.size, checks, correct };
    });
    return { concept, steps, contributors: contributors.filter(item => item.events.length || item.questions.length), variants,
      learnersWithSignals: contributors.filter(item => item.explanationRequests || item.incorrectChecks || item.retries || item.pendingQuestions || item.unmatchedQuestions).length,
      explanationRequests: sum('explanationRequests'), incorrectChecks: sum('incorrectChecks'), retries: sum('retries'),
      pendingQuestions: sum('pendingQuestions'), pauses: sum('pauses') };
  });
  return { records, concepts };
}

export function describeInsightEvent(event: ProgressEvent, lesson: LessonPackage): string {
  const step = 'timelineStepId' in event ? ` · ${event.timelineStepId}` : '';
  if (event.type === 'quiz-answered') {
    const quiz = lesson.quiz.find(item => item.id === event.quizId);
    const selected = event.selectedIndex === undefined ? '' : ` · Chose: ${quiz?.options[event.selectedIndex] ?? event.selectedIndex}`;
    return `Understanding check · ${event.correctness ? 'correct' : 'incorrect'} · ${quiz?.prompt ?? event.quizId}${selected}`;
  }
  if (event.type === 'variant-viewed' || event.type === 'tryit-completed' || event.type === 'tryit-follow-up') {
    const type = lesson.concepts.flatMap(item => item.variants).find(item => item.id === event.variantId)?.type;
    return `${event.type === 'variant-viewed' ? 'Explanation viewed' : event.type === 'tryit-completed' ? 'Activity completed (not proof of understanding)' : 'Activity reflection'} · ${type} · ${event.variantId}${step}`;
  }
  if (event.type === 'visual-explored') return `Alternative visual explored · ${event.visualAssetId} · recording ${event.recordingId} at ${(event.positionMs / 1000).toFixed(1)}s${step}`;
  if (event.type === 'question-matched') return `Prepared answer requested · ${event.originalText ?? event.questionId}${step}`;
  if (event.type === 'question-no-match') return `Question needed follow-up · ${event.questionId}${step}`;
  return `${event.type === 'explain-again' ? 'Explanation requested' : event.type === 'pause' ? 'Paused (context only)' : 'Section replayed'}${step}`;
}

export function questionPosition(question: QueuedQuestion): string {
  return question.recordedContext ? ` · recording ${question.recordedContext.recordingId} at ${(question.recordedContext.positionMs / 1000).toFixed(1)}s` : '';
}
