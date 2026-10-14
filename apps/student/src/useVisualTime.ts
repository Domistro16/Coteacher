import { useEffect, useRef, useState } from 'react';

export function useReducedVisualMotion() {
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(query.matches);
    query.addEventListener('change', change); return () => query.removeEventListener('change', change);
  }, []);
  return reduced;
}

/** Only standalone, visible previews own a clock. Recorded visuals supply media time. */
export function useVisualTime<T extends HTMLElement = HTMLElement>(identity: string, elapsedMs?: number, enabled = true) {
  const surface = useRef<T>(null);
  const [time, setTime] = useState(0);
  const ambientIdentity = useRef(identity);
  useEffect(() => {
    if (elapsedMs !== undefined || !enabled) return;
    ambientIdentity.current = identity;
    let frame = 0, visible = true, last = 0;
    const origin = performance.now(); setTime(0);
    const tick = (now: number) => {
      if (visible && !document.hidden && now - last >= 100) { setTime(now - origin); last = now; }
      frame = requestAnimationFrame(tick);
    };
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting);
      cancelAnimationFrame(frame);
      if (visible && !document.hidden) frame = requestAnimationFrame(tick);
    });
    const visibility = () => { cancelAnimationFrame(frame); if (visible && !document.hidden) frame = requestAnimationFrame(tick); };
    if (surface.current) observer?.observe(surface.current);
    document.addEventListener('visibilitychange', visibility);
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); observer?.disconnect(); document.removeEventListener('visibilitychange', visibility); };
  }, [identity, elapsedMs === undefined, enabled]);
  return { surface, time: elapsedMs ?? (ambientIdentity.current === identity ? time : 0) };
}
