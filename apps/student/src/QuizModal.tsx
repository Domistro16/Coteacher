import { useEffect, useRef, type ReactNode, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';

/** Native modal focus/inert behavior; the paused player remains mounted underneath. */
export function QuizModal({ children, onClose, onResume }: { children: ReactNode; onClose: () => void; onResume: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null), close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const element = dialog.current!, previous = document.activeElement as HTMLElement | null;
    element.showModal();
    return () => { element.close(); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  function keepFocus(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== 'Tab') return;
    const elements = [...dialog.current!.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])')].filter(element => element.getClientRects().length);
    const first = elements[0], last = elements.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  return createPortal(<dialog ref={dialog} className="contextual-quiz-modal" aria-labelledby="quick-check-title" onKeyDown={keepFocus} onCancel={event => { event.preventDefault(); close.current(); }}>
    <header><div><p className="eyebrow">COTEACHER</p><h2 id="quick-check-title">Your quick check</h2></div><button aria-label="Close quick check" onClick={onClose}>×</button></header>
    <div className="contextual-quiz-content">{children}</div>
    <footer><button onClick={onClose}>Back to our conversation</button><button className="primary" onClick={onResume}>Return to recorded lesson</button></footer>
  </dialog>, document.body);
}
