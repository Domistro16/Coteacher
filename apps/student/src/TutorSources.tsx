import type { TutorReply } from '@coteacher/shared';
export function TutorSources({ reply }: { reply: Pick<TutorReply, 'citations'> }) {
  return <details style={{ overflowWrap: 'anywhere' }}><summary>Answer sources · {reply.citations.length}</summary>{reply.citations.map((source, index) => <div key={source.sourceId + index} className="helper-note"><strong>{source.title}</strong><p>{/^https:\/\//.test(source.locator) ? <a href={source.locator} target="_blank" rel="noreferrer">{source.locator}</a> : source.locator}</p><blockquote>{source.excerpt}</blockquote><span>{source.kind === 'lesson' ? 'Teacher-approved lesson excerpt' : 'Curated educational source'}</span></div>)}</details>;
}
