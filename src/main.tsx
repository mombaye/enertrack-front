import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Après une mise à jour, un navigateur qui garde l'ancienne page peut demander des fichiers disparus : on recharge UNE fois (jamais de boucle).
window.addEventListener('vite:preloadError', () => {
  try {
    if (sessionStorage.getItem('egrid-reloaded-after-update')) return;
    sessionStorage.setItem('egrid-reloaded-after-update', '1');
  } catch { /* stockage indisponible : on recharge quand même une fois */ }
  window.location.reload();
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);