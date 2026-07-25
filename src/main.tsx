import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress cross-origin window inspection errors and benign runtime warnings
window.onerror = function (message, source, lineno, colno, error) {
  const msg = typeof message === 'string' ? message : error?.message || '';
  if (
    msg.includes('$$typeof') ||
    msg.includes('cross-origin frame') ||
    msg.includes('SecurityError') ||
    msg.includes('Failed to read a named property')
  ) {
    return true; // suppress error
  }
  return false;
};

window.addEventListener('error', (event) => {
  const msg = event.message || '';
  if (
    msg.includes('$$typeof') ||
    msg.includes('cross-origin frame') ||
    msg.includes('SecurityError') ||
    msg.includes('Failed to read a named property') ||
    msg.includes('Should not already be working') ||
    (event.filename && event.filename.includes('extensions::'))
  ) {
    event.preventDefault();
    event.stopPropagation();
  }
});

window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && typeof event.reason.message === 'string' && event.reason.message.includes('Should not already be working')) {
    event.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
