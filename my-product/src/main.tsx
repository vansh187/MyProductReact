
import { BrowserRouter } from 'react-router-dom';
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google';
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <GoogleOAuthProvider clientId="404760269080-m9r079j7h2lpq9sbunaeeovj9hteaq4s.apps.googleusercontent.com">
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </GoogleOAuthProvider>
  </ErrorBoundary>
)
