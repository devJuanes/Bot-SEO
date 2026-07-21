import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { SetupProvider } from './hooks/useSetup';
import { NotificationsProvider } from './hooks/useNotifications';
import { App } from './App';
import './styles/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SetupProvider>
          <NotificationsProvider>
            <App />
          </NotificationsProvider>
        </SetupProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
