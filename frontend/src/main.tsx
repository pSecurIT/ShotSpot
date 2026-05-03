import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { startAutoSync } from './utils/offlineSync';

const setupMobileKeyboardViewportHandling = () => {
  if (typeof window === 'undefined' || !window.visualViewport) {
    return;
  }

  const root = document.documentElement;
  const updateKeyboardInset = () => {
    const viewport = window.visualViewport;
    if (!viewport) {
      return;
    }

    const keyboardInset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
    root.style.setProperty('--keyboard-inset', `${keyboardInset}px`);
    document.body.classList.toggle('keyboard-open', keyboardInset > 0);
  };

  updateKeyboardInset();
  window.visualViewport.addEventListener('resize', updateKeyboardInset);
  window.visualViewport.addEventListener('scroll', updateKeyboardInset);
};

// Start auto-sync listener for offline actions
startAutoSync();
setupMobileKeyboardViewportHandling();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);