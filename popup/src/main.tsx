import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

// Global error handlers for the popup window
// These catch errors that occur outside React components

function logErrorToServiceWorker(source: string, error: Error | string, context: Record<string, any> = {}) {
  try {
    if (navigator.serviceWorker.controller) {
      const messageChannel = new MessageChannel();
      navigator.serviceWorker.controller.postMessage(
        {
          type: 'LOG_ERROR',
          data: {
            source,
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : null,
            context
          }
        },
        [messageChannel.port2]
      );
    }
  } catch (e) {
    console.error('[Popup] Failed to log error to service worker:', e);
  }
}

window.addEventListener('error', (event) => {
  console.error('[Popup] Uncaught error:', event.error);
  logErrorToServiceWorker('popup', event.error || event.message, {
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    type: 'uncaught-error'
  });
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Popup] Unhandled promise rejection:', event.reason);
  logErrorToServiceWorker('popup', event.reason, {
    type: 'unhandled-rejection'
  });
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
