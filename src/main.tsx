import React from 'react';
import ReactDOM from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './styles.css';
import { App } from './App';
import { controller } from './map/controller';
import { store } from './store';

// Debug/QA handle (used by browser-driven verification)
(window as any).__geocluster = { controller, store };

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
