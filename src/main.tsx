import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ToastProvider } from './context/ToastContext.tsx';

// Register Service Worker for Progressive Web App (PWA) support on Android/iOS
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('CME Service Worker registered with scope:', registration.scope);

        // 1. Check for updates immediately on load
        registration.update().catch(err => console.log('SW update check failed:', err));

        // 2. Force an update check when the page gains focus or visibility (e.g. user resumes/opens the app)
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            console.log('[PWA] App became visible. Checking for updates...');
            registration.update().catch(err => console.log('SW visibility update check failed:', err));
          }
        });

        // 3. Periodically check for updates every 5 minutes
        setInterval(() => {
          console.log('[PWA] Periodic check for updates...');
          registration.update().catch(err => console.log('SW periodic update check failed:', err));
        }, 1000 * 60 * 5);
      })
      .catch((error) => {
        console.error('CME Service Worker registration failed:', error);
      });

    // 4. Listen for service worker controlling changes (signaling a new worker took control)
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        console.log('[PWA] New version detected! Reloading page for instant updates...');
        window.location.reload();
      }
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
);
