import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ProjectorDisplay } from './ProjectorDisplay';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing application root');
const projectorSession = new URLSearchParams(location.search).get('projector');
createRoot(root).render(<StrictMode>{projectorSession && /^[a-zA-Z0-9-]{1,100}$/.test(projectorSession)
  ? <ProjectorDisplay session={projectorSession}/> : <App />}</StrictMode>);
