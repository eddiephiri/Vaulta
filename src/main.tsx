import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import './index.css';

// Register service worker (managed by vite-plugin-pwa)
import { registerSW } from 'virtual:pwa-register';

const updateSW = registerSW({
  onNeedRefresh() {
    // App has a new version available — you can show a toast here
    if (confirm('New version of Vaulta available. Update now?')) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log('Vaulta is ready to work offline.');
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
