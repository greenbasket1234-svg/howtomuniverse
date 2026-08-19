import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AdvertiserFilterProvider } from './context/AdvertiserFilterContext';
import { MetricsQueryProvider } from './context/MetricsQueryContext';
import App from './App';
import { runZeroStateMigration } from './utils/zeroStateMigration';
import './index.css';
import './control/control.css';

runZeroStateMigration();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AdvertiserFilterProvider>
          <MetricsQueryProvider>
            <App />
          </MetricsQueryProvider>
        </AdvertiserFilterProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
