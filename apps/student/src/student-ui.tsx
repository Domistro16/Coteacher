import type { ReactNode } from 'react';

export type IconName = 'home' | 'lessons' | 'download' | 'progress' | 'profile' | 'play' | 'pause' | 'back' | 'next' | 'help' | 'expand' | 'close' | 'check' | 'arrow' | 'spark' | 'mic';
const paths: Record<IconName, string> = {
  mic: 'M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0ZM5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8',
  home: 'M3 10 12 3l9 7v10H15v-6H9v6H3Z', lessons: 'M4 3h16v18H4ZM8 7h8M8 11h8M8 15h4',
  download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5', progress: 'M4 20h16M6 16v-5m6 5V5m6 11V8',
  profile: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-3a8 8 0 0 1 16 0v3',
  play: 'm8 4 12 8-12 8Z', pause: 'M8 4v16M16 4v16', back: 'm11 5-8 7 8 7ZM21 5l-10 7 10 7Z',
  next: 'm3 5 10 7-10 7ZM13 5l8 7-8 7Z', help: 'M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 4v.1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  expand: 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5', close: 'm6 6 12 12M18 6 6 18',
  check: 'm5 12 4 4L19 6', arrow: 'M4 12h16m-6-6 6 6-6 6', spark: 'm12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z',
};
export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/></svg>;
}
export function Brand() { return <span className="ct-brand"><span className="brand-symbol"><Icon name="play" size={20}/></span>coteacher<span className="brand-dot">.</span></span>; }
/** Original, decorative artwork; no instructional claims or remote dependencies. */
export function LearningArt() {
  return <svg className="learning-art" viewBox="0 0 340 230" aria-hidden="true">
    <circle cx="185" cy="115" r="96" fill="#f6c94b"/><circle cx="280" cy="43" r="18" fill="#b8efdd"/>
    <path d="m75 54 12-19 12 19-12 18Z" fill="#b8efdd"/><path d="m285 163 5-15 5 15 15 5-15 5-5 15-5-15-15-5Z" fill="#ff946a"/>
    <g transform="rotate(-12 160 122)"><rect x="67" y="67" width="184" height="120" rx="19" fill="#3c226d"/>
      <rect x="75" y="75" width="168" height="104" rx="13" fill="#fff"/><rect x="88" y="89" width="141" height="68" rx="9" fill="#e7ddff"/>
      <circle cx="158" cy="123" r="24" fill="#7541df"/><path d="m152 111 18 12-18 12Z" fill="white"/>
      <path d="M89 167h91" stroke="#cdc0ed" strokeWidth="5" strokeLinecap="round"/><circle cx="192" cy="167" r="4" fill="#f78350"/></g>
    <g transform="rotate(14 253 137)"><rect x="229" y="103" width="40" height="76" rx="5" fill="#ff946a"/><path d="M241 116h16m-16 12h16m-16 12h16" stroke="white" strokeWidth="3"/></g>
    <path d="M41 161q-15-26 10-38M47 163q-22-9-23 8" fill="none" stroke="#77cfb4" strokeWidth="7" strokeLinecap="round"/>
    <circle cx="116" cy="207" r="5" fill="#b8efdd"/><circle cx="314" cy="104" r="5" fill="white"/>
  </svg>;
}
export function EmptyState({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <section className="empty-state"><span className="empty-icon"><Icon name="lessons" size={34}/></span><h2>{title}</h2><p>{children}</p>{action}</section>;
}
export function clock(ms: number) { const s = Math.floor(Math.max(0, ms) / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
