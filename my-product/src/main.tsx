
import { BrowserRouter } from 'react-router-dom';
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google';
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <GoogleOAuthProvider clientId="686464101733-gffnqf60c81d0t097c5vjbpjsmvr9g1e.apps.googleusercontent.com">
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </GoogleOAuthProvider>
  </ErrorBoundary>
)
