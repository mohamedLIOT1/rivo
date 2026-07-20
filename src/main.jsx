import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { UserProvider } from './context/UserContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <UserProvider>
        <App />
      </UserProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
