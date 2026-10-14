import { useReducedVisualMotion } from './useVisualTime';

/** Original SVG companion. Mouth motion follows actual clip time, not invented speech. */
export function CoteacherAvatar({ speaking, listening, timeMs }: { speaking: boolean; listening: boolean; timeMs: number }) {
  const reduced = useReducedVisualMotion();
  const openness = speaking ? reduced ? 3 : 3 + Math.abs(Math.sin(timeMs / 140)) * 7 : 0;
  return <svg className="coteacher-avatar" viewBox="0 0 160 160" aria-hidden="true" data-state={speaking ? 'speaking' : listening ? 'listening' : 'ready'}>
    <circle cx="80" cy="80" r="75" fill="#e0f6ed"/>
    <path d="M24 44L29 35L34 44L29 53Z" fill="#ffbe5b"/><circle cx="133" cy="105" r="5" fill="#b8a0f3"/>
    <ellipse cx="80" cy="139" rx="38" ry="6" fill="#7040d8" opacity=".12"/>
    <g className="companion-body">
      <path d="M46 124Q80 103 114 124L120 137H40Z" fill="#7040d8"/>
      <path d="M45 126Q27 107 29 90M115 126Q134 107 132 90" fill="none" stroke="#7040d8" strokeWidth="9" strokeLinecap="round"/>
      <rect x="35" y="28" width="90" height="90" rx="34" fill="#7040d8"/>
      <rect x="43" y="41" width="74" height="62" rx="25" fill="#fff"/>
      <path d="M76 23L89 30L76 37Z" fill="#ffce69"/>
      <g className="companion-eyes"><ellipse cx="62" cy="67" rx="6" ry="8" fill="#30243f"/><ellipse cx="98" cy="67" rx="6" ry="8" fill="#30243f"/><circle cx="64" cy="64" r="2" fill="white"/><circle cx="100" cy="64" r="2" fill="white"/></g>
      <ellipse cx="53" cy="82" rx="6" ry="3" fill="#f9b5a1" opacity=".55"/><ellipse cx="107" cy="82" rx="6" ry="3" fill="#f9b5a1" opacity=".55"/>
      {speaking ? <ellipse cx="80" cy="86" rx="8" ry={openness} fill="#7040d8"/> : <path d="M70 83Q80 94 90 83" stroke="#7040d8" strokeWidth="3" fill="none" strokeLinecap="round"/>}
      <circle cx="80" cy="127" r="5" fill="#ffce69"/>
    </g>
  </svg>;
}
