import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './styles/theme.css';
import './styles/ThemeContrastFix.css';
import './index.css';
import './styles/responsive.css';
import './styles/light-polish.css';
import { initTheme } from './hooks/useTheme';
import { installStorageProxy } from './utils/storageProxy';

initTheme();

// Mirror all CMS localStorage writes to Supabase automatically.
installStorageProxy();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Hide the initial loading spinner once the app has mounted.
// A short minimum keeps the spinner visible long enough to read on fast loads.
(() => {
  const loader = document.getElementById('app-loader');
  if (!loader) return;
  const start = (window as any).__appLoaderStart || Date.now();
  const hide = () => {
    loader.classList.add('csl-hide');
    window.setTimeout(() => loader.remove(), 500);
  };
  const elapsed = Date.now() - start;
  window.setTimeout(hide, Math.max(0, 450 - elapsed));
})();
