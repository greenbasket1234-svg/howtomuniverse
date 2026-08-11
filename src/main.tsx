import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AdvertiserFilterProvider } from './context/AdvertiserFilterContext';
import App from './App';
import './index.css';
import './control/control.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AdvertiserFilterProvider>
          <App />
        </AdvertiserFilterProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
