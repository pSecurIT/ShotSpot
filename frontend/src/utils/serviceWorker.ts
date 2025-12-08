// Service worker registration function - only called after successful authentication
export const registerServiceWorker = async (): Promise<void> => {
  if ('serviceWorker' in navigator && typeof window !== 'undefined' && import.meta.env.PROD) {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js');
      console.log('[SW] Service Worker registered successfully:', registration.scope);

      // Check for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[SW] New service worker available. Refresh to update.');
              // Optionally notify user about update
            }
          });
        }
      });
    } catch (error) {
      console.error('[SW] Service Worker registration failed:', error);
    }
  }
};
