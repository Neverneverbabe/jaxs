import React from 'react';
import { createRoot } from 'react-dom/client';
import PageLayout from './PageLayout.jsx';

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<PageLayout />);
