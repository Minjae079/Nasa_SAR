import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';
import '../styles.css';
import '../responsive.css';
import '../compare.css';
import '../map.css';
import '../sky.css';
import './react.css';

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
