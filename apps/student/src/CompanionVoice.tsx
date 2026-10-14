import type { LessonPackage } from '@coteacher/shared';
import { CoteacherAvatar } from './CoteacherAvatar';
import { Sources } from './Visual';
import type { useCompanionSpeech } from './useCompanionSpeech';
import type { useLiveVoice } from './useLiveVoice';

export function CompanionVoice({ lesson, speech, listening, voiceEnabled, voiceStatus, voiceActionLabel = 'Enable offline voice mode', toggleVoice, beforeSpeech, live, label = 'Prepared lesson coach', docked = false, compact = false, prompt }: {
  lesson: LessonPackage; speech: ReturnType<typeof useCompanionSpeech>; listening: boolean;
  voiceEnabled: boolean; voiceStatus: string; toggleVoice: () => void; beforeSpeech: () => void;
  label?: string;
  voiceActionLabel?: string;
  live?: ReturnType<typeof useLiveVoice>;
  docked?: boolean; compact?: boolean;
  prompt?: string;
}) {
  if (live?.active) return <section className="companion-voice" aria-label="Coteacher live companion">
    <CoteacherAvatar speaking={live.state.speaking} listening={live.state.status === 'listening'} timeMs={live.state.timeMs}/>
    <div className="companion-bubble"><span className="eyebrow">{live.state.status === 'connecting' ? 'Connecting GPT-Live' : live.state.status === 'closing' ? 'Microphone off · ending session' : 'Microphone on · GPT-Live'}</span>
      <p className="companion-caption" tabIndex={0}>{live.state.status === 'connecting' || live.state.status === 'closing' ? live.state.message : live.state.caption || 'I’m listening. What are you struggling with?'}</p>
      <p role="status">{live.state.message}</p><div className="companion-audio-controls"><button aria-label="Play live voice" title="Play live voice" onClick={live.play} disabled={live.state.status === 'closing'}>Play live voice</button><button aria-label="End live conversation" title="End live conversation" onClick={live.stop}>End live conversation</button></div>
      <small>Teaching answers come from your sourced coach. Microphone audio goes to OpenAI while this conversation is on.</small>
    </div>
  </section>;
  return <section className={`companion-voice${compact ? ' companion-compact' : ''}`} aria-label="Coteacher companion">
    <CoteacherAvatar speaking={speech.speaking} listening={listening} timeMs={speech.timeMs}/>
    <div className="companion-bubble"><span className="eyebrow">{label}</span>
      <p className={`companion-caption${compact ? ' sr-only' : ''}`} tabIndex={compact ? undefined : 0} data-caption-index={speech.state.index}>{live?.state.status === 'error' ? live.state.message : ['playing', 'paused'].includes(speech.state.status) ? speech.state.caption : prompt || speech.state.caption || 'What would you like to ask?'}</p>
      {!docked && speech.refs.length > 0 && <details><summary>From your lesson</summary><Sources lesson={lesson} refs={speech.refs}/></details>}
      {speech.state.status !== 'off' && live?.state.status !== 'error' && <div className="companion-audio-controls"><button aria-label={speech.state.status === 'playing' ? 'Pause Coteacher' : 'Hear Coteacher'} onClick={() => { if (speech.state.status === 'playing') speech.pause(); else { beforeSpeech(); speech.play(); } }}>{speech.state.status === 'playing' ? 'Pause' : 'Listen'}</button><button aria-label="Say that again" onClick={() => { beforeSpeech(); speech.replay(); }}>Repeat</button></div>}
      <p className="companion-speech-status" role="status" data-status={speech.state.status} data-backend={speech.state.backend}>
        {speech.state.status === 'unavailable' ? 'This spoken clip could not play. You can read the explanation or try Hear Coteacher again.' : speech.state.status === 'off' ? 'Tap Hear Coteacher to listen. Your teacher’s place is saved.' : speech.state.message}
      </p>
    </div>
    {!docked && <div className="companion-voice-mode"><button aria-pressed={voiceEnabled} onClick={toggleVoice}>{voiceActionLabel}</button><p role="status">{voiceStatus}</p></div>}
  </section>;
}
