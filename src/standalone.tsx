import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BACKGROUND_EVENTS } from '@/constants/events';

import './globals.css';
import App from './main/App';

// Standalone page wrapper component
const StandaloneApp: React.FC = () => {
  useEffect(() => {
    chrome.runtime.sendMessage({
      type: BACKGROUND_EVENTS.POPUP_OPENED,
    });
  }, [])
  return (
    <div style={{ 
      width: '100%', 
      height: '100vh', 
      overflow: 'hidden',
      background: 'white'
    }}>
      <App />
    </div>
  );
};

// Initialize standalone page
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<StandaloneApp />);
} else {
  console.error('Root element not found in standalone page');
}