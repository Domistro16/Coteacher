import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon, clock } from './student-ui';

/** Detailed learning tools stay in the lesson page, outside the video canvas. */
export const CompanionToolsTarget = createContext<HTMLDivElement | null>(null);

/** A non-modal part of the player. The canvas and native controls stay operable. */
export function CompanionDock({ lessonId, conceptId, conceptTitle, positionMs, voice, children, composer, onClose, onResume, toolMode = 'help', voiceActive = false, requestInput = false }: {
  lessonId: string; conceptId: string; conceptTitle: string; positionMs: number;
  voice: ReactNode; children: ReactNode; composer: ReactNode; onClose: () => void; onResume: () => void;
  toolMode?: string;
  voiceActive?: boolean;
  requestInput?: boolean;
}) {
  const dismiss = useRef<HTMLButtonElement>(null);
  const overlay = useRef<HTMLElement>(null);
  const toolsTarget = useContext(CompanionToolsTarget);
  const [toolsOpen, setToolsOpen] = useState(false);
  useEffect(() => { if (requestInput) setToolsOpen(true); }, [requestInput]);
  useEffect(() => { if (voiceActive) setToolsOpen(false); }, [voiceActive]);
  useEffect(() => {
    if (!toolsOpen) return;
    overlay.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus({ preventScroll: true });
  }, [toolsOpen]);
  useLayoutEffect(() => {
    const element = overlay.current, player = element?.closest('.immersive-player');
    const visual = player?.querySelector('.replay-stage svg');
    if (!element || !player || !visual) return;
    // Anchor to the visual, including when controls wrap or annotations expand.
    const controls = player.querySelector('.player-controls');
    const place = () => {
      // A sourced answer can replace the SVG without changing the concept ID.
      const currentVisual = player.querySelector('.replay-stage svg');
      if (!currentVisual) return;
      element.style.setProperty('--companion-bottom', `${player.getBoundingClientRect().bottom - (toolsOpen && controls ? controls.getBoundingClientRect().top : currentVisual.getBoundingClientRect().bottom) + 8}px`);
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(player); observer.observe(visual);
    return () => observer.disconnect();
  }, [conceptId, toolsOpen]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dismiss.current?.focus({ preventScroll: true });
    return () => { if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  return <section ref={overlay} className={`companion-dock${toolsOpen ? ' is-composing' : ''}`} aria-label="Coteacher lesson companion"
    data-lesson-id={lessonId} data-concept-id={conceptId} data-recorded-position-ms={positionMs}
    onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } }}>
    <header className="companion-dock-heading sr-only"><div><h2>Coteacher</h2>
      <p>{conceptTitle} <span>· paused at {clock(positionMs)}</span></p></div>
      </header>
    {voice}
    {toolsOpen && <div className="companion-input" onSubmitCapture={() => window.setTimeout(() => setToolsOpen(false), 0)}>{composer}</div>}
    {toolMode === 'help' && <div className="companion-session-actions">{children}</div>}
    <footer className="companion-dock-footer">
      <button aria-label="Ask or explore this concept" title="Ask or explore this concept" aria-expanded={toolsOpen} onClick={() => setToolsOpen(!toolsOpen)}><Icon name="help"/></button>
      <button aria-label="Return to recorded lesson" title="Return to recorded lesson" onClick={onResume}><Icon name="play"/></button>
      <button ref={dismiss} aria-label="Close learning panel" title="Dismiss Coteacher (Escape)" onClick={onClose}><Icon name="close"/></button>
    </footer>
    {toolsTarget && toolMode !== 'help' && createPortal(<section className="companion-learning-task" aria-label="Current concept activity or check">{children}</section>, toolsTarget)}
  </section>;
}
