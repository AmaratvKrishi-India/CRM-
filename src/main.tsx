import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { reportOperationalError } from './services/operationalReportingService';

window.addEventListener('error', event => { void reportOperationalError('unhandled_error', event.error); });
window.addEventListener('unhandledrejection', event => { void reportOperationalError('unhandled_rejection', event.reason); });

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
