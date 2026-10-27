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
import { initClaudeServer } from './ai/claudeClient';

initTheme();

// Mirror all CMS localStorage writes to Supabase automatically.
installStorageProxy();

const renderApp = () => {
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
};

// Detect whether the server holds the Anthropic key (/api/claude).
// First visit: wait briefly (max 1.5 s) so AI pages render in the right mode.
// Later visits: use the cached answer instantly and refresh in the background.
let hasCachedAiStatus = false;
try { hasCachedAiStatus = localStorage.getItem('cms_claude_server_v1') !== null; } catch { /* ignore */ }
if (hasCachedAiStatus) {
  renderApp();
  void initClaudeServer();
} else {
  initClaudeServer(1500).finally(renderApp);
}
