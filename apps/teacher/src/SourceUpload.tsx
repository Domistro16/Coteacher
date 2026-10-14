import { useState } from 'react';
import { Icon } from '../../student/src/student-ui';

export function SourceUpload({ kind, loaded, busy, onFile, onRemove }: {
  kind: 'notes' | 'activity'; loaded: boolean; busy: boolean;
  onFile: (file: File) => Promise<boolean>; onRemove: () => void;
}) {
  const [name, setName] = useState('');
  const [dragging, setDragging] = useState(false);
  const id = `${kind}-file`;
  function choose(file?: File) { if (file && !busy) void onFile(file).then(saved => { if (saved) setName(file.name); }); }
  return <div className={`source-upload ${dragging ? 'dragging' : ''}`} onDragOver={event => { event.preventDefault(); if (!busy) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); choose(event.dataTransfer.files[0]); }}>
    <span className="source-upload-icon"><Icon name="download"/></span><label htmlFor={id}>{kind === 'notes' ? 'Teacher notes (.md / .txt)' : 'Approved activity source (.md / .txt)'}</label><p>Drop a file here, or choose from your device.</p><input id={id} type="file" accept=".md,.txt" disabled={busy} onChange={event => { choose(event.target.files?.[0]); event.target.value = ''; }}/><p className="small">Markdown or text · maximum 50 KB · reviewed refraction materials only</p>
    {loaded && <div className="uploaded-source"><Icon name="check" size={18}/><span>{name || (kind === 'notes' ? 'Saved teacher notes' : 'Saved activity notes')}<small>Source text loaded on this device</small></span><button disabled={busy} aria-label={`Remove ${kind === 'notes' ? 'teacher notes' : 'activity source'}`} onClick={() => { setName(''); onRemove(); }}><Icon name="close" size={18}/></button></div>}
  </div>;
}
