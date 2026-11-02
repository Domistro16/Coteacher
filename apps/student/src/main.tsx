import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

const SchoolStudent = lazy(() => import('./SchoolStudent').then(m => ({ default: m.SchoolStudent })));
const root = document.getElementById('root');
if (!root) throw new Error('Missing application root');
createRoot(root).render(<StrictMode>{import.meta.env.MODE !== 'demo' ? <Suspense fallback={<p>Opening your learning space...</p>}><SchoolStudent/></Suspense> : <App />}</StrictMode>);
