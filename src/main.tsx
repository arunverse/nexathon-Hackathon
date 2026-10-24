// MUST BE FIRST. Disables zod's `new Function` probe before any schema is
// constructed — see the note in zodSetup.ts for why the order matters.
import './lib/zodSetup'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from './contexts/ThemeContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
